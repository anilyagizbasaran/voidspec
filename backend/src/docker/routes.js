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

export async function dockerRoutes(fastify) {
  fastify.get('/api/docker/containers', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    try {
      const containers = await docker.listContainers({ all: true });
      const detailed = await Promise.all(
        containers.map(async c => {
          try {
            const container = docker.getContainer(c.Id);
            const stats = await container.stats({ stream: false });
            const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
            const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
            const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;
            const memUsed = stats.memory_stats.usage || 0;
            const memLimit = stats.memory_stats.limit || 1;

            return {
              ...formatContainer(c),
              cpu: Math.round(cpuPercent * 10) / 10,
              memory: { used: memUsed, limit: memLimit, percent: Math.round((memUsed / memLimit) * 1000) / 10 },
            };
          } catch {
            return { ...formatContainer(c), cpu: 0, memory: { used: 0, limit: 0, percent: 0 } };
          }
        })
      );
      reply.send(detailed);
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

  fastify.post('/api/docker/images/pull', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { image } = req.body;
    if (!image) return reply.code(400).send({ error: 'Image name required' });

    try {
      await new Promise((resolve, reject) => {
        docker.pull(image, (err, stream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err) => err ? reject(err) : resolve());
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
