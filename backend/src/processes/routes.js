import si from 'systeminformation';

const PROTECTED_PIDS = new Set([0, 1, 2]);
const MIN_SAFE_PID = 10;
const ALLOWED_SIGNALS = new Set(['SIGTERM', 'SIGKILL', 'SIGSTOP', 'SIGCONT', 'SIGHUP']);

export async function processRoutes(fastify) {
  fastify.get('/api/processes', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const result = await si.processes();

    const list = result.list
      .map(p => ({
        pid: p.pid,
        name: p.name,
        cpu: Math.round(p.cpu * 10) / 10,
        mem: Math.round(p.mem * 10) / 10,
        memRss: p.memRss,
        user: p.user,
        state: p.state,
        command: p.command?.slice(0, 120) || p.name,
        started: p.started,
        priority: p.priority,
      }))
      .sort((a, b) => b.cpu - a.cpu);

    reply.send({
      total: result.all,
      running: result.running,
      sleeping: result.sleeping,
      blocked: result.blocked,
      list,
    });
  });

  fastify.post('/api/processes/:pid/kill', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const pid = parseInt(req.params.pid, 10);
    const signal = req.body?.signal || 'SIGTERM';

    if (!Number.isInteger(pid) || pid <= 0) {
      return reply.code(400).send({ error: 'Invalid PID' });
    }

    if (PROTECTED_PIDS.has(pid) || pid < MIN_SAFE_PID) {
      return reply.code(403).send({ error: 'Cannot kill protected process' });
    }

    if (!ALLOWED_SIGNALS.has(signal)) {
      return reply.code(400).send({ error: 'Signal not allowed', allowed: [...ALLOWED_SIGNALS] });
    }

    if (pid === process.pid) {
      return reply.code(403).send({ error: 'Cannot kill the panel process' });
    }

    try {
      process.kill(pid, signal);
      fastify.log.info({ pid, signal }, 'Process signal sent');
      reply.send({ ok: true, pid, signal });
    } catch (err) {
      if (err.code === 'ESRCH') {
        return reply.code(404).send({ error: 'Process not found' });
      }
      if (err.code === 'EPERM') {
        return reply.code(403).send({ error: 'Permission denied' });
      }
      throw err;
    }
  });
}
