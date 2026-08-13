import { host, hostSpawn } from '../lib/host.js';
import { verifyWsAuth, rejectWs } from '../auth/middleware.js';

// Safe filename: no path traversal, only /var/log/ files
const FILE_RE = /^[a-zA-Z0-9_.-]+$/;
const ALLOWED_LOG_DIR = '/var/log';

const PRIORITY_MAP = { emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 };

const sanitizeUnit = (u) => String(u).replace(/[^a-zA-Z0-9._@:-]/g, '');

export function buildJournalArgs({ lines = '200', priority, unit, since, search, output = 'json' }) {
  const args = ['journalctl', '--no-pager', `--output=${output}`];
  if (lines) args.push('-n', String(Math.min(parseInt(lines, 10) || 200, 2000)));
  if (priority && PRIORITY_MAP[priority] !== undefined)
    args.push('-p', `0..${PRIORITY_MAP[priority]}`);
  if (unit) args.push('-u', sanitizeUnit(unit));
  if (since) args.push('--since', String(since).replace(/[^0-9\- :]/g, ''));
  // Arama journalctl'e devredildi. Eskiden önce -n ile son N satır alınıp
  // sonra JS'te filtreleniyordu; kullanıcı "geçmişte arıyorum" sanırken
  // aslında sadece son N satıra bakılıyordu.
  if (search) args.push('-g', String(search), '--case-sensitive=false');
  return args;
}

function parseJournalLine(line) {
  try {
    const j = JSON.parse(line);
    return {
      ts:       j.__REALTIME_TIMESTAMP ? new Date(parseInt(j.__REALTIME_TIMESTAMP) / 1000).toISOString() : '',
      priority: parseInt(j.PRIORITY ?? '6'),
      unit:     j._SYSTEMD_UNIT || j.SYSLOG_IDENTIFIER || j._COMM || '',
      pid:      j._PID || '',
      msg:      typeof j.MESSAGE === 'string' ? j.MESSAGE : JSON.stringify(j.MESSAGE),
      host:     j._HOSTNAME || '',
    };
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
export async function logRoutes(fastify) {

  // Journal query
  fastify.get('/api/logs/journal', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { lines = '300', priority, unit, since, search } = req.query;
    const { stdout } = await host(buildJournalArgs({ lines, priority, unit, since, search }), { timeout: 20000 });

    const entries = stdout.split('\n').filter(Boolean).map(parseJournalLine).filter(Boolean);
    reply.send({ entries, total: entries.length });
  });

  // List journal units (for filter dropdown)
  fastify.get('/api/logs/units', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { stdout } = await host(['journalctl', '--field', '_SYSTEMD_UNIT', '--no-pager']);
    const units = [...new Set(stdout.split('\n').filter(Boolean))].sort();
    reply.send({ units });
  });

  // List /var/log files
  fastify.get('/api/logs/files', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    // Dosya adı ve boyutu tek find çağrısıyla host namespace'inden alınır.
    // (Eskiden önce container içinden statSync denenip sonuç atılıyordu.)
    const { stdout } = await host([
      'find', ALLOWED_LOG_DIR, '-maxdepth', '1', '-type', 'f', '-name', '*.log', '-printf', '%f\\t%s\\n',
    ]);

    const files = stdout.split('\n')
      .filter(Boolean)
      .map(line => {
        const [name, sizeStr] = line.split('\t');
        return { name, path: `${ALLOWED_LOG_DIR}/${name}`, size: parseInt(sizeStr || '0', 10) };
      })
      .filter(f => FILE_RE.test(f.name))
      .sort((a, b) => b.size - a.size);

    reply.send({ files });
  });

  // Read a log file (tail)
  fastify.get('/api/logs/file/:name', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { name } = req.params;
    const { lines = '200', search } = req.query;

    if (!FILE_RE.test(name)) return reply.code(400).send({ error: 'Invalid filename' });

    const path = `${ALLOWED_LOG_DIR}/${name}`;
    const tailLines = String(Math.min(parseInt(lines, 10) || 200, 1000));
    const { stdout } = await host(['tail', '-n', tailLines, '--', path]);

    let content = stdout;
    if (search) {
      const q = String(search).toLowerCase();
      content = content.split('\n').filter(l => l.toLowerCase().includes(q)).join('\n');
    }

    reply.send({ content, lines: content ? content.split('\n').length : 0 });
  });

  // Real-time journal follow — WebSocket.
  // /api/ altındayken nginx bu yolu WebSocket olarak proxy'lemiyordu
  // (Upgrade/Connection header'ları sadece /ws/ location'ında var), yani canlı
  // takip Docker kurulumunda hiç çalışmıyordu. Route /ws/ altına taşındı.
  fastify.get('/ws/logs/stream', { websocket: true }, (socket, req) => {
    if (!verifyWsAuth(fastify, req)) return rejectWs(socket);

    const { unit, priority } = req.query;
    const args = ['journalctl', '-f', '--output=json', '--no-pager'];
    if (priority && PRIORITY_MAP[priority] !== undefined) args.push('-p', `0..${PRIORITY_MAP[priority]}`);
    if (unit) args.push('-u', sanitizeUnit(unit));

    const proc = hostSpawn(args);
    let partial = '';

    proc.stdout.on('data', chunk => {
      // Bir JSON satırı chunk sınırında ikiye bölünebilir; yarım satırı sakla.
      partial += chunk.toString();
      const lines = partial.split('\n');
      partial = lines.pop() ?? '';
      for (const line of lines) {
        const entry = parseJournalLine(line);
        if (entry && socket.readyState === 1) {
          try { socket.send(JSON.stringify(entry)); } catch { /* kapanmış */ }
        }
      }
    });

    proc.stderr.on('data', () => {});
    proc.on('exit', () => { try { socket.close(); } catch { /* kapalı */ } });

    const stop = () => { try { proc.kill(); } catch { /* bitmiş */ } };
    socket.on('close', stop);
    socket.on('error', stop);
  });
}
