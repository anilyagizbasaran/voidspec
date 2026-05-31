import pty from 'node-pty';
import { config } from '../config.js';

// sessionId -> { ptyProcess, buffer, dataDisposable, reconnectTimer }
const sessions = new Map();
const BUFFER_MAX = 512 * 1024; // 512 KB
const RECONNECT_TIMEOUT = 20 * 60 * 1000; // 20 dakika

function spawnPty(cols, rows) {
  let cmd, args;
  if (config.sshHost) {
    cmd = 'ssh';
    args = [
      '-i', '/root/.ssh/panel_key',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'LogLevel=ERROR',
      `${config.sshUser}@${config.sshHost}`,
    ];
  } else {
    cmd = 'bash';
    args = [];
  }

  return pty.spawn(cmd, args, {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: process.env.HOME || '/',
    env: { ...process.env, TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
  });
}

function attachSocket(session, sessionId, socket) {
  const { ptyProcess } = session;

  // Önceki onData handler'ı temizle (yeniden bağlanma durumunda)
  if (session.dataDisposable) {
    session.dataDisposable.dispose();
  }

  session.dataDisposable = ptyProcess.onData(data => {
    session.buffer += data;
    if (session.buffer.length > BUFFER_MAX) {
      session.buffer = session.buffer.slice(session.buffer.length - BUFFER_MAX);
    }
    if (socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'data', data }));
    }
  });

  socket.on('message', raw => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'input') ptyProcess.write(msg.data);
      else if (msg.type === 'resize') ptyProcess.resize(msg.cols, msg.rows);
      else if (msg.type === 'kill') {
        // Kullanıcı terminali manuel kapattı
        ptyProcess.kill();
        sessions.delete(sessionId);
      }
    } catch {}
  });

  socket.on('close', () => {
    // Hemen öldürme; yeniden bağlanma için bekle
    if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
    session.reconnectTimer = setTimeout(() => {
      ptyProcess.kill();
      sessions.delete(sessionId);
    }, RECONNECT_TIMEOUT);
  });
}

export async function terminalWs(fastify) {
  fastify.get('/ws/terminal', { websocket: true }, (socket, req) => {
    try {
      const token = req.cookies?.token;
      if (!token) { socket.send(JSON.stringify({ type: 'error', data: 'Unauthorized' })); socket.close(); return; }
      fastify.jwt.verify(token);
    } catch {
      socket.send(JSON.stringify({ type: 'error', data: 'Unauthorized' })); socket.close(); return;
    }

    const requestedId = req.query?.sessionId;
    const existing = requestedId ? sessions.get(requestedId) : null;

    if (existing) {
      // Mevcut session'a yeniden bağlan
      if (existing.reconnectTimer) {
        clearTimeout(existing.reconnectTimer);
        existing.reconnectTimer = null;
      }

      // Önce sessionId gönder, sonra buffer'ı gönder
      socket.send(JSON.stringify({ type: 'session', sessionId: requestedId }));
      if (existing.buffer.length > 0) {
        socket.send(JSON.stringify({ type: 'data', data: existing.buffer }));
      }

      attachSocket(existing, requestedId, socket);

      existing.ptyProcess.onExit(() => {
        sessions.delete(requestedId);
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type: 'exit' }));
          socket.close();
        }
      });
    } else {
      // Yeni session oluştur
      const sessionId = Math.random().toString(36).slice(2);
      const ptyProcess = spawnPty(80, 24);
      const session = { ptyProcess, buffer: '', dataDisposable: null, reconnectTimer: null };
      sessions.set(sessionId, session);

      socket.send(JSON.stringify({ type: 'session', sessionId }));

      attachSocket(session, sessionId, socket);

      ptyProcess.onExit(() => {
        sessions.delete(sessionId);
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type: 'exit' }));
          socket.close();
        }
      });
    }
  });
}
