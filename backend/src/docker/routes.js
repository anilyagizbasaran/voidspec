import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

function formatContainer(c) {
  return {
    id: c.Id,
    shortId: c.Id.substring(0, 12),
    name: c.Names?.[0]?.replace('/', '') || 'unnamed',
    image: c.Image,
    status: c.Status,
    state: c.State,
    created: c.Created,
    ports: c.Ports || [],
  };
}

function formatImage(img) {
  return {
    id: img.Id,
    shortId: img.Id.replace('sha256:', '').substring(0, 12),
    tags: img.RepoTags || [],
    size: img.Size,
    created: img.Created,
  };
}

// ── Stats cache ──────────────────────────────────────────────────────────────
// Docker'ın one-shot stats çağrısı container başına ~1 saniye sürüyor. Eskiden
// her istek TÜM container'lar için (durmuş olanlar dahil) bunu paralel
// çağırıyordu: 7 container'da ölçülen süre 3.7 sn, frontend ise 3 saniyede bir
// soruyordu — istekler üst üste biniyordu.
//
// Artık: yanıt her zaman cache'ten anında dönüyor, cache bayatladığında arka
// planda tek bir yenileme çalışıyor (stale-while-revalidate) ve sadece çalışan
// container'lar sorgulanıyor.
const STATS_TTL_MS = 5000;
const EMPTY_STATS = { cpu: 0, memory: { used: 0, limit: 0, percent: 0 } };

const statsCache = new Map(); // id -> { cpu, memory }
let statsRefreshedAt = 0;
let statsInFlight = null;

function computeStats(stats) {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cores = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * cores * 100 : 0;
  const memUsed = stats.memory_stats.usage || 0;
  const memLimit = stats.memory_stats.limit || 1;
  return {
    cpu: Math.round(cpuPercent * 10) / 10,
    memory: { used: memUsed, limit: memLimit, percent: Math.round((memUsed / memLimit) * 1000) / 10 },
  };
}

async function refreshStats(containers) {
  const running = containers.filter(c => c.State === 'running');
  await Promise.all(running.map(async c => {
    try {
      const stats = await docker.getContainer(c.Id).stats({ stream: false });
      statsCache.set(c.Id, computeStats(stats));
    } catch {
      statsCache.set(c.Id, EMPTY_STATS);
    }
  }));

  // Artık var olmayan / durmuş container'ları cache'ten düşür.
  const alive = new Set(running.map(c => c.Id));
  for (const id of statsCache.keys()) {
    if (!alive.has(id)) statsCache.delete(id);
  }
  statsRefreshedAt = Date.now();
}

function scheduleStatsRefresh(containers) {
  if (statsInFlight) return statsInFlight;
  if (Date.now() - statsRefreshedAt < STATS_TTL_MS) return null;
  statsInFlight = refreshStats(containers)
    .catch(() => { statsRefreshedAt = Date.now(); })
    .finally(() => { statsInFlight = null; });
  return statsInFlight;
}

export async function dockerRoutes(fastify) {
  fastify.get('/api/docker/containers', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    try {
      const containers = await docker.listContainers({ all: true });
      const refresh = scheduleStatsRefresh(containers);

      // İlk istekte elde hiç veri yok — o zaman bekliyoruz. Sonrasında bayat
      // veriyi anında dönüp yenilemeyi arka planda bırakıyoruz.
      if (refresh && statsCache.size === 0) await refresh;

      reply.send(containers.map(c => ({
        ...formatContainer(c),
        ...(statsCache.get(c.Id) || EMPTY_STATS),
      })));
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.post('/api/docker/containers/:id/start', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    try {
      await docker.getContainer(req.params.id).start();
      reply.send({ ok: true });
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.post('/api/docker/containers/:id/stop', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    try {
      await docker.getContainer(req.params.id).stop();
      reply.send({ ok: true });
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.post('/api/docker/containers/:id/restart', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    try {
      await docker.getContainer(req.params.id).restart();
      reply.send({ ok: true });
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.delete('/api/docker/containers/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    try {
      await docker.getContainer(req.params.id).remove({ force: true });
      statsCache.delete(req.params.id);
      reply.send({ ok: true });
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.get('/api/docker/images', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    try {
      const images = await docker.listImages();
      reply.send(images.map(formatImage));
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.post('/api/docker/images/pull', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    const { image } = req.body || {};
    if (!image || typeof image !== 'string') {
      return reply.code(400).send({ error: 'Image name required' });
    }

    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Pull timeout (5 min)')), 5 * 60 * 1000);
        docker.pull(image, (err, stream) => {
          if (err) { clearTimeout(timer); return reject(err); }
          docker.modem.followProgress(stream, (err) => {
            clearTimeout(timer);
            err ? reject(err) : resolve();
          });
        });
      });
      reply.send({ ok: true });
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.delete('/api/docker/images/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    try {
      await docker.getImage(req.params.id).remove({ force: true });
      reply.send({ ok: true });
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });
}
