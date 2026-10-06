import pty from 'node-pty';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { verifyWsAuth, rejectWs } from '../auth/middleware.js';

// sessionId -> { ptyProcess, buffer, owner, dataDisposable, exitDisposable, reconnectTimer, socket }
const sessions = new Map();
const BUFFER_MAX = 512 * 1024; // 512 KB

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

function destroySession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  clearTimeout(session.reconnectTimer);
  session.dataDisposable?.dispose();
  session.exitDisposable?.dispose();
  try { session.ptyProcess.kill(); } catch { /* zaten ölmüş */ }
  sessions.delete(sessionId);
}

function attachSocket(session, sessionId, socket) {
  const { ptyProcess } = session;

  // Aynı oturuma yeni bir socket bağlandıysa eskisini kapat. Ağ kopmasında
  // sunucu eski bağlantının öldüğünü istemci yeniden bağlandıktan SONRA fark
  // edebiliyor; eski socket'in geç gelen 'close' olayı aktif oturum için
  // yok etme sayacı kuruyor ve kullanılan terminal 20 dk sonra kapanıyordu.
  const previous = session.socket;
  session.socket = socket;
  if (previous && previous !== socket) {
    try {
      if (previous.readyState === 1) previous.send(JSON.stringify({ type: 'detached' }));
      previous.close();
    } catch { /* zaten kapalı */ }
  }

  // Önceki handler'ları temizle. Eskiden sadece onData temizleniyordu, onExit
  // her yeniden bağlanmada tekrar ekleniyor ve listener birikiyordu.
  session.dataDisposable?.dispose();
  session.exitDisposable?.dispose();
  clearTimeout(session.reconnectTimer);
  session.reconnectTimer = null;

  session.dataDisposable = ptyProcess.onData(data => {
    session.buffer += data;
    if (session.buffer.length > BUFFER_MAX) {
      session.buffer = session.buffer.slice(session.buffer.length - BUFFER_MAX);
    }
    if (socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'data', data }));
    }
  });

  session.exitDisposable = ptyProcess.onExit(() => {
    sessions.delete(sessionId);
    if (socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'exit' }));
      socket.close();
    }
  });

  socket.on('message', raw => {
    if (session.socket !== socket) return;
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'input') ptyProcess.write(msg.data);
      else if (msg.type === 'resize') ptyProcess.resize(msg.cols, msg.rows);
      else if (msg.type === 'kill') {
        // Kullanıcı terminali manuel kapattı
        destroySession(sessionId);
      }
    } catch { /* bozuk mesajı yok say */ }
  });

  socket.on('close', () => {
    // Hemen öldürme; yeniden bağlanma için bekle
    if (!sessions.has(sessionId)) return;
    // Oturum başka bir socket'e devredildiyse bu kapanma onu ilgilendirmez.
    if (session.socket !== socket) return;
    session.socket = null;
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = setTimeout(() => destroySession(sessionId), config.terminalReconnectMs);
  });
}

export async function terminalWs(fastify) {
  fastify.addHook('onClose', async () => {
    for (const id of [...sessions.keys()]) destroySession(id);
  });

  fastify.get('/ws/terminal', { websocket: true }, (socket, req) => {
    const user = verifyWsAuth(fastify, req);
    if (!user) return rejectWs(socket);

    const requestedId = req.query?.sessionId;
    const existing = requestedId ? sessions.get(requestedId) : null;

    if (existing) {
      // Session sahibi olmayan biri, geçerli bir token'la başkasının canlı
      // shell'ine bağlanamasın.
      if (existing.owner !== user.username) return rejectWs(socket, 'Session not available');

      socket.send(JSON.stringify({ type: 'session', sessionId: requestedId }));
      if (existing.buffer.length > 0) {
        socket.send(JSON.stringify({ type: 'data', data: existing.buffer }));
      }
      attachSocket(existing, requestedId, socket);
      return;
    }

    // Sınırsız session açılabilmesi PTY bombasına açık kapı bırakıyordu.
    if (sessions.size >= config.maxTerminalSessions) {
      return rejectWs(socket, `Terminal session limit reached (${config.maxTerminalSessions})`);
    }

    // Math.random() yerine kriptografik kimlik: session id'si tahmin edilemez.
    const sessionId = randomUUID();
    const session = {
      ptyProcess: spawnPty(80, 24),
      buffer: '',
      owner: user.username,
      dataDisposable: null,
      exitDisposable: null,
      reconnectTimer: null,
      socket: null,
    };
    sessions.set(sessionId, session);

    socket.send(JSON.stringify({ type: 'session', sessionId }));
    attachSocket(session, sessionId, socket);
  });
}
