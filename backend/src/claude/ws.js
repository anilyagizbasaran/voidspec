import pty from 'node-pty';

export async function claudeWs(fastify) {
  fastify.get('/ws/claude', { websocket: true }, (socket, req) => {
    try {
      const token = req.cookies?.token;
      if (!token) { socket.send(JSON.stringify({ type: 'error', data: 'Unauthorized' })); socket.close(); return; }
      fastify.jwt.verify(token);
    } catch {
      socket.send(JSON.stringify({ type: 'error', data: 'Unauthorized' })); socket.close(); return;
    }

    const ptyProcess = pty.spawn(process.env.HOME + '/.local/bin/claude', [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || '/',
      env: process.env,
    });

    ptyProcess.onData(data => {
      if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'data', data }));
    });

    ptyProcess.onExit(() => {
      if (socket.readyState === 1) { socket.send(JSON.stringify({ type: 'exit' })); socket.close(); }
    });

    socket.on('message', raw => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'input') ptyProcess.write(msg.data);
        else if (msg.type === 'resize') ptyProcess.resize(msg.cols, msg.rows);
      } catch {}
    });

    socket.on('close', () => ptyProcess.kill());
  });
}
