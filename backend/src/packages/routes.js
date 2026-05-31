import { execSync, execFileSync } from 'child_process';

const NS = ['nsenter', '--mount=/proc/1/ns/mnt', '--'];
const ENV = { ...process.env, DEBIAN_FRONTEND: 'noninteractive', PATH: '/usr/sbin:/usr/bin:/sbin:/bin' };

function run(cmd, opts = {}) {
  try {
    return execFileSync(NS[0], [...NS.slice(1), 'sh', '-c', cmd], { timeout: 30000, env: ENV, ...opts }).toString().trim();
  } catch (e) { return e.stdout?.toString().trim() || ''; }
}

function runOrThrow(cmd, opts = {}) {
  return execFileSync(NS[0], [...NS.slice(1), 'sh', '-c', cmd], { timeout: 120000, env: ENV, ...opts }).toString().trim();
}

// Parse dpkg -l output
function parseInstalled(raw) {
  const pkgs = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('ii')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const [status, name, version, arch, ...descParts] = parts;
    pkgs.push({ name: name.split(':')[0], version, arch, description: descParts.join(' ') });
  }
  return pkgs;
}

// Parse apt list --upgradable
function parseUpgradable(raw) {
  const pkgs = [];
  for (const line of raw.split('\n')) {
    if (line === 'Listing...' || !line.trim()) continue;
    // name/suite version arch [upgradable from: oldver]
    const m = line.match(/^([^/]+)\/\S+\s+(\S+)\s+(\S+)\s+\[upgradable from: ([^\]]+)\]/);
    if (!m) continue;
    const [, name, newVersion, arch, oldVersion] = m;
    pkgs.push({ name, newVersion, oldVersion, arch });
  }
  return pkgs;
}

// Validate package name — only safe chars
const PKG_RE = /^[a-z0-9][a-z0-9.+\-]{0,200}$/;
function validatePkg(name) {
  if (!name || !PKG_RE.test(name))
    throw { code: 400, message: 'Invalid package name' };
}

// Dangerous meta-packages that should not be removed
const PROTECTED = new Set(['base-files', 'bash', 'coreutils', 'dpkg', 'apt', 'libc6', 'linux-base', 'openssh-server', 'systemd', 'init']);

export async function packageRoutes(fastify) {

  // List installed
  fastify.get('/api/packages', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { search = '', limit = '200', offset = '0' } = req.query;
    const raw = run('dpkg -l');
    let pkgs = parseInstalled(raw);

    if (search) {
      const q = search.toLowerCase();
      pkgs = pkgs.filter(p => p.name.includes(q) || p.description.toLowerCase().includes(q));
    }

    const total = pkgs.length;
    const page  = pkgs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    reply.send({ packages: page, total });
  });

  // Upgradable
  fastify.get('/api/packages/upgradable', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const raw = run('apt list --upgradable 2>/dev/null');
    reply.send({ packages: parseUpgradable(raw) });
  });

  // apt update (refresh package index)
  fastify.post('/api/packages/update', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const out = run('apt-get update -q 2>&1');
    fastify.log.info('apt update ran');
    reply.send({ ok: true, output: out.slice(-2000) });
  });

  // Install package — streams output via SSE
  fastify.post('/api/packages/install', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    const { name } = req.body || {};
    try { validatePkg(name); } catch (e) { return reply.code(e.code).send({ error: e.message }); }

    try {
      const out = runOrThrow(`apt-get install -y ${name} 2>&1`);
      fastify.log.info({ name }, 'Package installed');
      reply.send({ ok: true, output: out.slice(-3000) });
    } catch (e) {
      reply.code(500).send({ error: 'Install failed', output: e.stdout?.toString().slice(-2000) || e.message });
    }
  });

  // Remove package
  fastify.delete('/api/packages/:name', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    const { name } = req.params;
    const { purge = 'false' } = req.query;
    try { validatePkg(name); } catch (e) { return reply.code(e.code).send({ error: e.message }); }

    if (PROTECTED.has(name)) {
      return reply.code(403).send({ error: `Package "${name}" is protected and cannot be removed` });
    }

    try {
      const flag = purge === 'true' ? '--purge' : '';
      const out = runOrThrow(`apt-get remove ${flag} -y ${name} 2>&1`);
      fastify.log.info({ name, purge }, 'Package removed');
      reply.send({ ok: true, output: out.slice(-3000) });
    } catch (e) {
      reply.code(500).send({ error: 'Remove failed', output: e.stdout?.toString().slice(-2000) || e.message });
    }
  });

  // Upgrade single or all packages
  fastify.post('/api/packages/upgrade', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const { name } = req.body || {};

    try {
      let out;
      if (name) {
        validatePkg(name);
        out = runOrThrow(`apt-get install --only-upgrade -y ${name} 2>&1`);
        fastify.log.info({ name }, 'Package upgraded');
      } else {
        out = runOrThrow('apt-get upgrade -y 2>&1');
        fastify.log.info('Full system upgrade ran');
      }
      reply.send({ ok: true, output: out.slice(-3000) });
    } catch (e) {
      reply.code(500).send({ error: 'Upgrade failed', output: e.stdout?.toString().slice(-2000) || e.message });
    }
  });

  // Package info
  fastify.get('/api/packages/:name/info', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { name } = req.params;
    try { validatePkg(name); } catch (e) { return reply.code(e.code).send({ error: e.message }); }

    const info   = run(`apt-cache show ${name} 2>/dev/null | head -40`);
    const policy = run(`apt-cache policy ${name} 2>/dev/null`);
    reply.send({ info, policy });
  });
}
