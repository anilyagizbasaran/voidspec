import { execSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';

const NSENTER = 'nsenter --mount=/proc/1/ns/mnt --';

function run(cmd) {
  try {
    return execSync(`${NSENTER} ${cmd}`, { timeout: 8000 }).toString();
  } catch (e) {
    return e.stdout?.toString() || '';
  }
}

// Parse a crontab line. hasUser=true for /etc/crontab and /etc/cron.d files
function parseLine(rawLine, source, idx, hasUser = false) {
  const line = rawLine.trim();
  if (!line) return null;

  const disabled = line.startsWith('#');
  const content = disabled ? line.replace(/^#+\s*/, '') : line;

  const isSpecial = /^@(reboot|yearly|annually|monthly|weekly|daily|hourly|midnight)/.test(content);
  let schedule, user = null, command;

  if (isSpecial) {
    const sp = content.indexOf(' ');
    if (sp === -1) return null;
    schedule = content.slice(0, sp);
    const rest = content.slice(sp + 1).trim();
    if (hasUser) {
      const parts = rest.split(/\s+/);
      if (parts.length < 2) return null;
      user = parts[0];
      command = parts.slice(1).join(' ');
    } else {
      command = rest;
    }
  } else {
    const parts = content.split(/\s+/);
    const minFields = hasUser ? 7 : 6;
    if (parts.length < minFields) return null;
    // Validate first field looks like cron
    if (!/^[\d\*\-\/,]+$/.test(parts[0])) return null;
    schedule = parts.slice(0, 5).join(' ');
    if (hasUser) {
      user = parts[5];
      command = parts.slice(6).join(' ');
    } else {
      command = parts.slice(5).join(' ');
    }
  }

  if (!command?.trim()) return null;

  // Skip commented lines in system sources — they are examples, not intentionally disabled jobs
  if (disabled && source !== 'root') return null;

  return {
    id: `${source}:${idx}`,
    source,
    schedule,
    user,
    command: command.trim(),
    enabled: !disabled,
    raw: rawLine,
    editable: source === 'root',
  };
}

function readRootCrontab() {
  const raw = run('crontab -l');
  const lines = raw.split('\n');
  const jobs = [];
  lines.forEach((line, i) => {
    const job = parseLine(line, 'root', i, false);
    if (job) jobs.push(job);
  });
  return jobs;
}

function readSystemCrontab() {
  const raw = run('cat /etc/crontab');
  const jobs = [];
  raw.split('\n').forEach((line, i) => {
    // Skip comment-only lines and env vars
    if (/^[A-Z_]+=/.test(line.trim())) return;
    const job = parseLine(line, 'system', i, true);
    if (job) jobs.push(job);
  });
  return jobs;
}

function readCronD() {
  const jobs = [];
  try {
    const files = run('ls /etc/cron.d/').trim().split('\n').filter(Boolean);
    for (const file of files) {
      const content = run(`cat /etc/cron.d/${file}`);
      content.split('\n').forEach((line, i) => {
        if (/^[A-Z_]+=/.test(line.trim())) return;
        const job = parseLine(line, `cron.d/${file}`, i, true);
        if (job) jobs.push(job);
      });
    }
  } catch {}
  return jobs;
}

function readCronDirs() {
  const dirs = { hourly: [], daily: [], weekly: [], monthly: [] };
  for (const [name] of Object.entries(dirs)) {
    try {
      const files = run(`ls /etc/cron.${name}/`).trim().split('\n').filter(Boolean);
      dirs[name] = files;
    } catch {}
  }
  return dirs;
}

// Write back root's full crontab from a lines array
function writeRootCrontab(lines) {
  const content = lines.join('\n') + '\n';
  // Pipe via echo to crontab; use -n flag to write to temp file first
  const escaped = content.replace(/'/g, "'\\''");
  execSync(`${NSENTER} bash -c 'echo '"'"'${escaped}'"'"' | crontab -'`, { timeout: 8000 });
}

function getRootCrontabLines() {
  return run('crontab -l').split('\n');
}

export async function cronRoutes(fastify) {
  fastify.get('/api/cron', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const [root, system, crond, dirs] = await Promise.all([
      Promise.resolve(readRootCrontab()),
      Promise.resolve(readSystemCrontab()),
      Promise.resolve(readCronD()),
      Promise.resolve(readCronDirs()),
    ]);

    reply.send({ jobs: [...root, ...system, ...crond], dirs });
  });

  fastify.post('/api/cron', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { schedule, command } = req.body || {};
    if (!schedule?.trim() || !command?.trim()) {
      return reply.code(400).send({ error: 'schedule and command required' });
    }

    const lines = getRootCrontabLines();
    const newLine = `${schedule.trim()} ${command.trim()}`;
    // Remove trailing empty line if present, append, re-add newline
    const trimmed = lines.filter((l, i) => !(i === lines.length - 1 && l === ''));
    trimmed.push(newLine);
    writeRootCrontab(trimmed);

    fastify.log.info({ schedule, command }, 'Cron job added');
    reply.send({ ok: true });
  });

  fastify.put('/api/cron/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params;
    const { schedule, command, enabled } = req.body || {};

    const [source, idxStr] = id.split(':');
    if (source !== 'root') {
      return reply.code(403).send({ error: 'Only root crontab jobs can be edited' });
    }

    const idx = parseInt(idxStr, 10);
    const lines = getRootCrontabLines();
    if (idx < 0 || idx >= lines.length) {
      return reply.code(404).send({ error: 'Job not found' });
    }

    // Build new line — preserve existing format if only toggling enabled
    const oldLine = lines[idx].trim();
    const wasDisabled = oldLine.startsWith('#');
    const baseContent = wasDisabled ? oldLine.replace(/^#+\s*/, '') : oldLine;

    let newLine;
    if (schedule !== undefined && command !== undefined) {
      newLine = `${schedule.trim()} ${command.trim()}`;
    } else {
      newLine = baseContent;
    }

    if (enabled === false) newLine = `# ${newLine}`;

    lines[idx] = newLine;
    writeRootCrontab(lines);

    fastify.log.info({ id, schedule, command, enabled }, 'Cron job updated');
    reply.send({ ok: true });
  });

  fastify.delete('/api/cron/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params;
    const [source, idxStr] = id.split(':');

    if (source !== 'root') {
      return reply.code(403).send({ error: 'Only root crontab jobs can be deleted' });
    }

    const idx = parseInt(idxStr, 10);
    const lines = getRootCrontabLines();
    if (idx < 0 || idx >= lines.length) {
      return reply.code(404).send({ error: 'Job not found' });
    }

    lines.splice(idx, 1);
    writeRootCrontab(lines);

    fastify.log.info({ id }, 'Cron job deleted');
    reply.send({ ok: true });
  });
}
