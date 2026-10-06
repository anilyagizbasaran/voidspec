import { host } from '../lib/host.js';

// Zaman aşımı dolunca apt-get SIGTERM ile öldürülüyor. 120 sn'lik eski değer
// büyük bir `upgrade`'i dpkg'nin ortasında kesiyor ve paket sistemini
// "dpkg was interrupted" durumunda bırakıyordu. Süre bilerek uzun; nginx'in
// /api/packages/ proxy zaman aşımı da buna göre ayarlı.
const APT_TIMEOUT = 30 * 60 * 1000;

// Etkileşimsiz çalışma için: başka bir apt/unattended-upgrades kilidi
// tutuyorsa hemen hata vermek yerine bekle; conffile sorularında mevcut
// dosyayı koru (aksi halde soru stdin'de asılı kalıp zaman aşımına düşüyordu).
const APT_OPTS = [
  '-o', 'DPkg::Lock::Timeout=120',
  '-o', 'Dpkg::Options::=--force-confdef',
  '-o', 'Dpkg::Options::=--force-confold',
];

function combined({ stdout, stderr }) {
  return [stdout, stderr].filter(Boolean).join('\n').trim();
}

// Parse dpkg -l output
function parseInstalled(raw) {
  const pkgs = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('ii')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const [, name, version, arch, ...descParts] = parts;
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
const PKG_RE = /^[a-z0-9][a-z0-9.+-]{0,200}$/;
export function validatePkg(name) {
  if (!name || !PKG_RE.test(name))
    throw { code: 400, message: 'Invalid package name' };
}

// Dangerous meta-packages that should not be removed
const PROTECTED = new Set(['base-files', 'bash', 'coreutils', 'dpkg', 'apt', 'libc6', 'linux-base', 'openssh-server', 'systemd', 'init']);

export async function packageRoutes(fastify) {

  // List installed
  fastify.get('/api/packages', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { search = '', limit = '200', offset = '0' } = req.query;
    const { stdout } = await host(['dpkg', '-l'], { timeout: 30000 });
    let pkgs = parseInstalled(stdout);

    if (search) {
      const q = search.toLowerCase();
      pkgs = pkgs.filter(p => p.name.includes(q) || p.description.toLowerCase().includes(q));
    }

    const total = pkgs.length;
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 200, 1000));
    const off = Math.max(0, parseInt(offset, 10) || 0);
    reply.send({ packages: pkgs.slice(off, off + lim), total });
  });

  // Upgradable
  fastify.get('/api/packages/upgradable', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { stdout } = await host(['apt', 'list', '--upgradable'], { timeout: 30000 });
    reply.send({ packages: parseUpgradable(stdout) });
  });

  // apt update (refresh package index)
  fastify.post('/api/packages/update', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const res = await host(['apt-get', ...APT_OPTS, 'update', '-q'], { timeout: APT_TIMEOUT });
    fastify.log.info('apt update ran');
    reply.send({ ok: res.ok, output: combined(res).slice(-2000) });
  });

  // Install package
  fastify.post('/api/packages/install', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    const { name } = req.body || {};
    try { validatePkg(name); } catch (e) { return reply.code(e.code).send({ error: e.message }); }

    const res = await host(['apt-get', ...APT_OPTS, 'install', '-y', name], { timeout: APT_TIMEOUT });
    if (!res.ok) {
      return reply.code(500).send({ error: 'Install failed', output: combined(res).slice(-2000) });
    }
    fastify.log.info({ name }, 'Package installed');
    reply.send({ ok: true, output: combined(res).slice(-3000) });
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

    const args = ['apt-get', ...APT_OPTS, 'remove'];
    if (purge === 'true') args.push('--purge');
    args.push('-y', name);

    const res = await host(args, { timeout: APT_TIMEOUT });
    if (!res.ok) {
      return reply.code(500).send({ error: 'Remove failed', output: combined(res).slice(-2000) });
    }
    fastify.log.info({ name, purge }, 'Package removed');
    reply.send({ ok: true, output: combined(res).slice(-3000) });
  });

  // Upgrade single or all packages
  fastify.post('/api/packages/upgrade', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const { name } = req.body || {};

    let args;
    if (name) {
      try { validatePkg(name); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
      args = ['apt-get', ...APT_OPTS, 'install', '--only-upgrade', '-y', name];
    } else {
      args = ['apt-get', ...APT_OPTS, 'upgrade', '-y'];
    }

    const res = await host(args, { timeout: APT_TIMEOUT });
    if (!res.ok) {
      return reply.code(500).send({ error: 'Upgrade failed', output: combined(res).slice(-2000) });
    }
    fastify.log.info({ name: name || 'all' }, 'Package upgrade ran');
    reply.send({ ok: true, output: combined(res).slice(-3000) });
  });

  // Package info
  fastify.get('/api/packages/:name/info', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { name } = req.params;
    try { validatePkg(name); } catch (e) { return reply.code(e.code).send({ error: e.message }); }

    const [show, policy] = await Promise.all([
      host(['apt-cache', 'show', name]),
      host(['apt-cache', 'policy', name]),
    ]);
    // `| head -40` yerine kesmeyi burada yapıyoruz — shell'e ihtiyaç yok.
    reply.send({
      info: show.stdout.split('\n').slice(0, 40).join('\n'),
      policy: policy.stdout,
    });
  });
}
