import Docker from 'dockerode';
import { PassThrough } from 'stream';
import { verifyWsAuth, rejectWs } from '../auth/middleware.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Docker'ın multiplexed log akışı 8 baytlık başlıklarla gelir:
// [stream(1)][0,0,0][uzunluk(4, big-endian)][payload]. Eskiden bu başlıklar
// regex ile kırpılıyordu; log içeriğinde benzer bayt dizileri olduğunda
// satırları bozuyordu. Artık gerçek çerçeve çözümlemesi yapılıyor.
export function demuxBuffer(buf) {
  let out = '';
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const type = buf[offset];
    // Geçerli bir başlık değilse (TTY modundaki ham çıktı gibi) kalanı düz metin say.
    if (type > 2 || buf[offset + 1] !== 0 || buf[offset + 2] !== 0 || buf[offset + 3] !== 0) {
      return out + buf.slice(offset).toString('utf8');
    }
    const len = buf.readUInt32BE(offset + 4);
    out += buf.slice(offset + 8, offset + 8 + len).toString('utf8');
    offset += 8 + len;
  }
  return out + (offset < buf.length ? buf.slice(offset).toString('utf8') : '');
}

export async function dockerLogsWs(fastify) {
  fastify.get('/ws/docker/logs/:id', { websocket: true }, async (socket, req) => {
    if (!verifyWsAuth(fastify, req)) return rejectWs(socket);

    const containerId = req.params.id;
    let stream = null;

    try {
      const container = docker.getContainer(containerId);
      const info = await container.inspect();
      const tty = !!info.Config?.Tty;

      // Son 200 satırı gönder
      const history = await container.logs({ stdout: true, stderr: true, tail: 200, timestamps: true });
      const historyBuf = Buffer.isBuffer(history) ? history : Buffer.from(history);
      socket.send(JSON.stringify({
        type: 'history',
        data: tty ? historyBuf.toString('utf8') : demuxBuffer(historyBuf),
      }));

      // Sonra canlı akış
      stream = await container.logs({ stdout: true, stderr: true, follow: true, tail: 0, timestamps: true });

      const send = (text) => {
        if (socket.readyState === 1 && text) socket.send(JSON.stringify({ type: 'log', data: text }));
      };

      if (tty) {
        stream.on('data', chunk => send(chunk.toString('utf8')));
      } else {
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        stdout.on('data', chunk => send(chunk.toString('utf8')));
        stderr.on('data', chunk => send(chunk.toString('utf8')));
        container.modem.demuxStream(stream, stdout, stderr);
      }

      stream.on('error', () => { try { socket.close(); } catch { /* kapalı */ } });
      stream.on('end', () => { try { socket.close(); } catch { /* kapalı */ } });
    } catch (err) {
      try { socket.send(JSON.stringify({ type: 'error', data: err.message })); } catch { /* kapalı */ }
      socket.close();
    }

    socket.on('close', () => {
      try { stream?.destroy(); } catch { /* zaten kapalı */ }
    });
  });
}
