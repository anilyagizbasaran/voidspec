import { execSync, execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// nsenter into host mount namespace so systemctl/journalctl are available
const NSENTER = ['nsenter', '--mount=/proc/1/ns/mnt', '--'];

// Only alphanumeric, dash, dot, @, colon — no path traversal possible
const SERVICE_NAME_RE = /^[a-zA-Z0-9._@:-]+\.service$/;
const ALLOWED_ACTIONS = new Set(['start', 'stop', 'restart', 'reload', 'enable', 'disable']);

function validateService(name) {
  if (!name || !SERVICE_NAME_RE.test(name)) {
    throw { code: 400, message: 'Invalid service name' };
  }
}

async function nsctl(...args) {
  const [cmd, ...rest] = args;
  const { stdout, stderr } = await execFileAsync(NSENTER[0], [...NSENTER.slice(1), cmd, ...rest], {
    timeout: 10000,
  }).catch(err => ({ stdout: err.stdout || '', stderr: err.stderr || '' }));
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

function parseServiceList(raw) {
  const services = [];
  for (const line of raw.split('\n')) {
    // Strip leading bullet/whitespace
    const clean = line.replace(/^[●○\s]+/, '').trim();
    if (!clean || !clean.includes('.service')) continue;
    const parts = clean.split(/\s+/);
    if (parts.length < 4) continue;
    const [unit, load, active, sub, ...descParts] = parts;
    if (!unit.endsWith('.service')) continue;
    services.push({
      unit,
      load,
      active,
      sub,
      description: descParts.join(' '),
    });
  }
  return services;
}

function parseUnitFiles(raw) {
  const map = {};
  for (const line of raw.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const [unit, state] = parts;
    if (unit.endsWith('.service')) map[unit] = state; // enabled/disabled/static/masked
  }
  return map;
}

export async function serviceRoutes(fastify) {
  fastify.get('/api/services', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const [unitsRes, filesRes] = await Promise.all([
      nsctl('systemctl', 'list-units', '--type=service', '--all', '--no-pager', '--no-legend', '--full', '--plain'),
      nsctl('systemctl', 'list-unit-files', '--type=service', '--no-pager', '--no-legend', '--full', '--plain'),
    ]);

    const services = parseServiceList(unitsRes.stdout);
    const fileStates = parseUnitFiles(filesRes.stdout);

    const merged = services.map(s => ({
      ...s,
      enabled: fileStates[s.unit] || 'static',
    }));

    // Also add unit-file-only entries (installed but not loaded at runtime)
    const loadedUnits = new Set(services.map(s => s.unit));
    for (const [unit, state] of Object.entries(fileStates)) {
      if (!loadedUnits.has(unit)) {
        merged.push({ unit, load: 'not-loaded', active: 'inactive', sub: 'dead', description: '', enabled: state });
      }
    }

    merged.sort((a, b) => a.unit.localeCompare(b.unit));
    reply.send({ services: merged });
  });

  fastify.post('/api/services/:name/action', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { name } = req.params;
    const { action } = req.body || {};

    try { validateService(name); } catch (e) {
      return reply.code(e.code).send({ error: e.message });
    }

    if (!ALLOWED_ACTIONS.has(action)) {
      return reply.code(400).send({ error: 'Invalid action', allowed: [...ALLOWED_ACTIONS] });
    }

    const { stdout, stderr } = await nsctl('systemctl', action, name);
    fastify.log.info({ name, action }, 'Service action');

    // For enable/disable, reload the daemon
    if (action === 'enable' || action === 'disable') {
      await nsctl('systemctl', 'daemon-reload').catch(() => {});
    }

    reply.send({ ok: true, name, action, output: stdout || stderr || '' });
  });

  fastify.get('/api/services/:name/status', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { name } = req.params;
    try { validateService(name); } catch (e) {
      return reply.code(e.code).send({ error: e.message });
    }

    const { stdout } = await nsctl('systemctl', 'status', name, '--no-pager', '-l');
    reply.send({ status: stdout });
  });

  fastify.get('/api/services/:name/logs', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { name } = req.params;
    const lines = Math.min(parseInt(req.query.lines || '100', 10), 500);

    try { validateService(name); } catch (e) {
      return reply.code(e.code).send({ error: e.message });
    }

    const { stdout } = await nsctl(
      'journalctl', '-u', name, '-n', String(lines),
      '--no-pager', '--output=short-iso', '--no-hostname'
    );
    reply.send({ logs: stdout });
  });
}
