import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function dockerLogsWs(fastify) {
  fastify.get('/ws/docker/logs/:id', { websocket: true }, async (socket, req) => {
    try {
      const token = req.cookies?.sp_token;
      if (!token) throw new Error('Unauthorized');
      fastify.jwt.verify(token);
    } catch {
      socket.send(JSON.stringify({ type: 'error', data: 'Unauthorized' }));
      socket.close();
      return;
    }

    const containerId = req.params.id;

    try {
      const container = docker.getContainer(containerId);

      // Send last 200 lines first
      const logs = await container.logs({ stdout: true, stderr: true, tail: 200, timestamps: true });
      const logStr = logs.toString('utf8');
      // Strip docker multiplexed stream headers (8 bytes each)
      const cleaned = logStr.replace(/[\x00-\x08]\x00\x00\x00[\s\S]{4}/g, '');
      socket.send(JSON.stringify({ type: 'history', data: cleaned }));

      // Then stream new logs
      const stream = await container.logs({ stdout: true, stderr: true, follow: true, tail: 0, timestamps: true });

      stream.on('data', chunk => {
        if (socket.readyState === 1) {
          const text = chunk.toString('utf8').replace(/^[\x00-\x08]\x00\x00\x00.{4}/gm, '');
          socket.send(JSON.stringify({ type: 'log', data: text }));
        }
      });

      stream.on('end', () => socket.close());

      socket.on('close', () => {
        try { stream.destroy(); } catch {}
      });
    } catch (err) {
      socket.send(JSON.stringify({ type: 'error', data: err.message }));
      socket.close();
    }
  });
}
