import { execFileSync, spawn } from 'child_process';
import { readdirSync, statSync } from 'fs';

const NS  = ['nsenter', '--mount=/proc/1/ns/mnt', '--'];
const ENV = { ...process.env, PATH: '/usr/sbin:/usr/bin:/sbin:/bin' };

function nsExec(args, opts = {}) {
  return execFileSync(NS[0], [...NS.slice(1), ...args], { timeout: 15000, env: ENV, ...opts }).toString();
}

// Safe filename: no path traversal, only /var/log/ files
const FILE_RE = /^[a-zA-Z0-9_.\-]+$/;
const ALLOWED_LOG_DIR = '/var/log';

const PRIORITY_MAP = { emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 };

function buildJournalArgs({ lines = '200', priority, unit, since, search, output = 'json' }) {
  const args = ['journalctl', '--no-pager', `--output=${output}`];
  if (lines)    args.push('-n', String(Math.min(parseInt(lines), 2000)));
  if (priority && PRIORITY_MAP[priority] !== undefined)
    args.push('-p', `0..${PRIORITY_MAP[priority]}`);
  if (unit)     args.push('-u', unit.replace(/[^a-zA-Z0-9._@:\-]/g, ''));
  if (since)    args.push('--since', since.replace(/[^0-9\- :]/g, ''));
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
    const args = buildJournalArgs({ lines, priority, unit, since });

    let raw = '';
    try { raw = nsExec(args); } catch (e) { raw = e.stdout?.toString() || ''; }

    let entries = raw.split('\n').filter(Boolean).map(parseJournalLine).filter(Boolean);

    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(e => e.msg.toLowerCase().includes(q) || e.unit.toLowerCase().includes(q));
    }

    reply.send({ entries, total: entries.length });
  });

  // List journal units (for filter dropdown)
  fastify.get('/api/logs/units', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let raw = '';
    try {
      raw = nsExec(['journalctl', '--field', '_SYSTEMD_UNIT', '--no-pager']);
    } catch (e) { raw = e.stdout?.toString() || ''; }
    const units = [...new Set(raw.split('\n').filter(Boolean))].sort();
    reply.send({ units });
  });

  // List /var/log files
  fastify.get('/api/logs/files', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let files = [];
    try {
      const raw = nsExec(['find', ALLOWED_LOG_DIR, '-maxdepth', '1', '-type', 'f', '-name', '*.log']);
      files = raw.split('\n').filter(Boolean).map(path => {
        try {
          const name = path.split('/').pop();
          const stat = statSync(path); // inside container, /var/log is accessible via proc/1 mount? No — use nsExec
          return { name, path, size: 0 };
        } catch { return null; }
      }).filter(Boolean);
    } catch {}

    // Get sizes via stat command in host namespace
    try {
      const statOut = nsExec(['find', ALLOWED_LOG_DIR, '-maxdepth', '1', '-type', 'f', '-name', '*.log', '-printf', '%f\t%s\n']);
      files = statOut.split('\n').filter(Boolean).map(line => {
        const [name, sizeStr] = line.split('\t');
        return { name, size: parseInt(sizeStr || '0') };
      }).filter(f => FILE_RE.test(f.name));
    } catch {}

    files.sort((a, b) => b.size - a.size);
    reply.send({ files });
  });

  // Read a log file (tail)
  fastify.get('/api/logs/file/:name', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { name } = req.params;
    const { lines = '200', search } = req.query;

    if (!FILE_RE.test(name)) return reply.code(400).send({ error: 'Invalid filename' });

    const path = `${ALLOWED_LOG_DIR}/${name}`;
    let content = '';
    try {
      content = nsExec(['tail', '-n', String(Math.min(parseInt(lines), 1000)), path]);
    } catch (e) { content = e.stdout?.toString() || 'Error reading file'; }

    if (search) {
      const q = search.toLowerCase();
      content = content.split('\n').filter(l => l.toLowerCase().includes(q)).join('\n');
    }

    reply.send({ content, lines: content.split('\n').length });
  });

  // Real-time journal follow — WebSocket
  fastify.get('/api/logs/stream', { websocket: true, onRequest: [fastify.authenticate] }, (socket, req) => {
    const { unit, priority } = req.query;

    const args = [...NS.slice(1), 'journalctl', '-f', '--output=json', '--no-pager'];
    if (priority && PRIORITY_MAP[priority] !== undefined)
      args.push('-p', `0..${PRIORITY_MAP[priority]}`);
    if (unit) args.push('-u', unit.replace(/[^a-zA-Z0-9._@:\-]/g, ''));

    const proc = spawn(NS[0], args, { env: ENV });

    proc.stdout.on('data', chunk => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        const entry = parseJournalLine(line);
        if (entry) {
          try { socket.send(JSON.stringify(entry)); } catch {}
        }
      }
    });

    proc.stderr.on('data', () => {});

    socket.on('close', () => { proc.kill(); });
    socket.on('error', () => { proc.kill(); });

    proc.on('exit', () => {
      try { socket.close(); } catch {}
    });
  });
}
