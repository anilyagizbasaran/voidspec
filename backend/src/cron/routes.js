import { host, hostInput } from '../lib/host.js';

// Parse a crontab line. hasUser=true for /etc/crontab and /etc/cron.d files
export function parseLine(rawLine, source, idx, hasUser = false) {
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
    if (!/^[\d*\-/,]+$/.test(parts[0])) return null;
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

async function readRootCrontab() {
  const jobs = [];
  (await getRootCrontabLines()).forEach((line, i) => {
    const job = parseLine(line, 'root', i, false);
    if (job) jobs.push(job);
  });
  return jobs;
}

async function readSystemCrontab() {
  const { stdout: raw } = await host(['cat', '/etc/crontab']);
  const jobs = [];
  raw.split('\n').forEach((line, i) => {
    // Skip comment-only lines and env vars
    if (/^[A-Z_]+=/.test(line.trim())) return;
    const job = parseLine(line, 'system', i, true);
    if (job) jobs.push(job);
  });
  return jobs;
}

async function readCronD() {
  const jobs = [];
  const { stdout: listing } = await host(['ls', '/etc/cron.d/']);
  const files = listing.split('\n').filter(Boolean);
  // Dosyaları paralel okuyoruz; sırayla okumak dosya başına bir nsenter turu demekti.
  const contents = await Promise.all(
    // Dosya adı listeden geliyor ama yine de yol ayracı içeren adları atlıyoruz.
    files.filter(f => !f.includes('/')).map(async (file) => ({
      file,
      content: (await host(['cat', `/etc/cron.d/${file}`])).stdout,
    })),
  );
  for (const { file, content } of contents) {
    content.split('\n').forEach((line, i) => {
      if (/^[A-Z_]+=/.test(line.trim())) return;
      const job = parseLine(line, `cron.d/${file}`, i, true);
      if (job) jobs.push(job);
    });
  }
  return jobs;
}

async function readCronDirs() {
  const names = ['hourly', 'daily', 'weekly', 'monthly'];
  const listings = await Promise.all(names.map(n => host(['ls', `/etc/cron.${n}/`])));
  return Object.fromEntries(
    names.map((n, i) => [n, listings[i].stdout.split('\n').filter(Boolean)]),
  );
}

// Root'un crontab'ını komple yazar. Eskiden içerik `echo '...' | crontab -`
// şeklinde shell komut satırına gömülüyordu: tırnak kaçırma kırılgandı ve uzun
// crontab ARG_MAX'a takılabiliyordu. Artık içerik stdin'den gidiyor.
async function writeRootCrontab(lines) {
  await hostInput(['crontab', '-'], lines.join('\n').replace(/\n+$/, '') + '\n');
}

async function getRootCrontabLines() {
  const { stdout } = await host(['crontab', '-l']);
  return stdout.split('\n');
}

// Listeleme ile düzenleme arasında crontab değişmişse yanlış satırı
// düzenlememek için, istemcinin gördüğü satırla karşılaştırıyoruz.
function staleLine(lines, idx, expectedRaw) {
  if (expectedRaw === undefined || expectedRaw === null) return false;
  return (lines[idx] ?? '').trim() !== String(expectedRaw).trim();
}

export async function cronRoutes(fastify) {
  fastify.get('/api/cron', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const [rootJobs, systemJobs, cronDJobs, dirs] = await Promise.all([
      readRootCrontab(), readSystemCrontab(), readCronD(), readCronDirs(),
    ]);
    reply.send({ jobs: [...rootJobs, ...systemJobs, ...cronDJobs], dirs });
  });

  fastify.post('/api/cron', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { schedule, command } = req.body || {};
    const cleanSchedule = schedule?.trim().replace(/[\r\n]/g, '') || '';
    const cleanCommand = command?.trim().replace(/[\r\n]/g, '') || '';
    if (!cleanSchedule || !cleanCommand) {
      return reply.code(400).send({ error: 'schedule and command required' });
    }

    const lines = (await getRootCrontabLines()).filter((l, i, arr) => !(i === arr.length - 1 && l === ''));
    lines.push(`${cleanSchedule} ${cleanCommand}`);
    await writeRootCrontab(lines);

    fastify.log.info({ schedule: cleanSchedule }, 'Cron job added');
    reply.send({ ok: true });
  });

  fastify.put('/api/cron/:id', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { schedule, command, enabled, expectedRaw } = req.body || {};

    const [source, idxStr] = req.params.id.split(':');
    if (source !== 'root') {
      return reply.code(403).send({ error: 'Only root crontab jobs can be edited' });
    }

    const idx = parseInt(idxStr, 10);
    const lines = await getRootCrontabLines();
    if (isNaN(idx) || idx < 0 || idx >= lines.length) {
      return reply.code(404).send({ error: 'Job not found' });
    }
    if (staleLine(lines, idx, expectedRaw)) {
      return reply.code(409).send({ error: 'Crontab bu arada değişti — listeyi yenileyip tekrar deneyin' });
    }

    // Build new line — preserve existing format if only toggling enabled
    const oldLine = lines[idx].trim();
    const wasDisabled = oldLine.startsWith('#');
    const baseContent = wasDisabled ? oldLine.replace(/^#+\s*/, '') : oldLine;

    let newLine;
    if (schedule !== undefined && command !== undefined) {
      const cleanSchedule = schedule.trim().replace(/[\r\n]/g, '');
      const cleanCommand = command.trim().replace(/[\r\n]/g, '');
      newLine = `${cleanSchedule} ${cleanCommand}`;
    } else {
      newLine = baseContent;
    }

    if (enabled === false) newLine = `# ${newLine}`;

    lines[idx] = newLine;
    await writeRootCrontab(lines);

    fastify.log.info({ id: req.params.id, enabled }, 'Cron job updated');
    reply.send({ ok: true });
  });

  fastify.delete('/api/cron/:id', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const [source, idxStr] = req.params.id.split(':');
    if (source !== 'root') {
      return reply.code(403).send({ error: 'Only root crontab jobs can be deleted' });
    }

    const idx = parseInt(idxStr, 10);
    const lines = await getRootCrontabLines();
    if (isNaN(idx) || idx < 0 || idx >= lines.length) {
      return reply.code(404).send({ error: 'Job not found' });
    }
    if (staleLine(lines, idx, req.query.expectedRaw)) {
      return reply.code(409).send({ error: 'Crontab bu arada değişti — listeyi yenileyip tekrar deneyin' });
    }

    lines.splice(idx, 1);
    await writeRootCrontab(lines);

    fastify.log.info({ id: req.params.id }, 'Cron job deleted');
    reply.send({ ok: true });
  });
}
