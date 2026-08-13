import { host, hostOrThrow } from '../lib/host.js';

// Panelin dışarıya açık portları. UFW açılırken bunlar mutlaka izinli olmalı,
// yoksa duvarı açan istek kendi bağlantısını koparıyor.
const PANEL_PORTS = ['8080/tcp', '8443/tcp'];

// Detect SSH port from sshd config
async function getSshPort() {
  const { stdout: out } = await host(['sshd', '-T']);
  const m = out.match(/^port (\d+)/m);
  if (m) return parseInt(m[1]);

  const { stdout: conf } = await host(['cat', '/etc/ssh/sshd_config']);
  const m2 = conf.match(/^\s*Port\s+(\d+)/m);
  if (m2) return parseInt(m2[1]);

  return 22;
}

// Parse `ufw status numbered` output into structured rules
function parseUfwRules(raw) {
  const rules = [];
  for (const line of raw.split('\n')) {
    // Match: [ 1] 22/tcp   ALLOW IN   Anywhere
    const m = line.match(/^\[\s*(\d+)\]\s+(.+?)\s{2,}(ALLOW|DENY|REJECT|LIMIT)\s*(IN|OUT)?\s+(.+)$/);
    if (!m) continue;
    const [, num, to, action, direction, from] = m;
    rules.push({
      num: parseInt(num),
      to: to.trim(),
      action: action.trim(),
      direction: (direction || 'IN').trim(),
      from: from.trim(),
    });
  }
  return rules;
}

function parseIptables(raw) {
  const rules = [];
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('Chain') || line.startsWith('num') || line.startsWith('target')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const [num, target, prot, , src, dst, ...extra] = parts;
    if (!num || isNaN(parseInt(num))) continue;
    rules.push({ num: parseInt(num), target, prot, src, dst, extra: extra.join(' ') });
  }
  return rules;
}

function isSshRule(rule, sshPort) {
  return rule.action === 'ALLOW' && (
    rule.to === String(sshPort) ||
    rule.to.startsWith(`${sshPort}/`) ||
    rule.to === 'OpenSSH'
  );
}

const MUTATING_RATE = { max: 15, timeWindow: '1 minute' };

// `ufw status` + iptables listelemesi 0.5-3 saniye sürüyor ve panel bunu
// widget'tan 30, panelden 10 saniyede bir çağırıyor. Kısa ömürlü cache ile
// aynı anda gelen istekler tek bir çalıştırmayı paylaşır.
const STATUS_TTL_MS = 5000;
let statusCache = { at: 0, data: null };
let statusInFlight = null;

async function collectStatus() {
  // Beş komut birbirinden bağımsız — sırayla değil paralel çalıştırıyoruz.
  const [statusRes, rulesRes, iptInRes, iptOutRes, sshPort] = await Promise.all([
    host(['ufw', 'status', 'verbose']),
    host(['ufw', 'status', 'numbered']),
    host(['iptables', '-L', 'INPUT', '--line-numbers', '-n']),
    host(['iptables', '-L', 'OUTPUT', '--line-numbers', '-n']),
    getSshPort(),
  ]);

  const statusRaw = statusRes.stdout;
  const rulesRaw = rulesRes.stdout;
  const active = /Status:\s*active/i.test(statusRaw);
  const rules = parseUfwRules(rulesRaw);

  return {
    active,
    sshPort,
    sshProtected: rules.some(r => isSshRule(r, sshPort)),
    rules,
    iptables: {
      input: parseIptables(iptInRes.stdout),
      output: parseIptables(iptOutRes.stdout),
    },
    raw: active ? rulesRaw : statusRaw,
  };
}

function invalidateStatus() {
  statusCache = { at: 0, data: null };
}

async function getStatus() {
  if (statusCache.data && Date.now() - statusCache.at < STATUS_TTL_MS) {
    return statusCache.data;
  }
  if (!statusInFlight) {
    statusInFlight = collectStatus()
      .then(data => {
        statusCache = { at: Date.now(), data };
        return data;
      })
      .finally(() => { statusInFlight = null; });
  }
  return statusInFlight;
}

export async function firewallRoutes(fastify) {
  // ── Status ──────────────────────────────────────────────────────────────────
  fastify.get('/api/firewall/status', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    reply.send(await getStatus());
  });

  // ── Enable UFW ──────────────────────────────────────────────────────────────
  fastify.post('/api/firewall/enable', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: MUTATING_RATE },
  }, async (req, reply) => {
    const sshPort = await getSshPort();
    const { stdout } = await host(['ufw', 'status', 'numbered']);
    const rules = parseUfwRules(stdout);

    // Always ensure SSH is allowed before enabling
    const sshAllowed = rules.some(r => isSshRule(r, sshPort));
    if (!sshAllowed) {
      await host(['ufw', 'allow', `${sshPort}/tcp`, 'comment', 'SSH - auto-added by ServerPanel']);
    }

    // Panelin kendi portları da izinli olmalı, yoksa duvar açılır açılmaz
    // arayüz erişilemez hale geliyor.
    for (const port of PANEL_PORTS) {
      await host(['ufw', 'allow', port, 'comment', 'ServerPanel']);
    }

    await hostOrThrow(['ufw', '--force', 'enable']);
    invalidateStatus();
    fastify.log.info('UFW enabled');
    reply.send({ ok: true, sshAutoAdded: !sshAllowed, sshPort });
  });

  // ── Disable UFW ─────────────────────────────────────────────────────────────
  fastify.post('/api/firewall/disable', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: MUTATING_RATE },
  }, async (req, reply) => {
    await hostOrThrow(['ufw', '--force', 'disable']);
    invalidateStatus();
    fastify.log.info('UFW disabled');
    reply.send({ ok: true });
  });

  // ── Add rule ────────────────────────────────────────────────────────────────
  fastify.post('/api/firewall/rules', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: MUTATING_RATE },
  }, async (req, reply) => {
    const { action, direction, proto, port, from, comment } = req.body || {};

    const validActions = ['allow', 'deny', 'reject', 'limit'];
    const validDirections = ['in', 'out', ''];
    const validProtos = ['tcp', 'udp', 'any', ''];

    if (!validActions.includes(action)) {
      return reply.code(400).send({ error: 'Invalid action' });
    }
    if (!validDirections.includes(direction || '')) {
      return reply.code(400).send({ error: 'Invalid direction' });
    }
    if (!validProtos.includes(proto || '')) {
      return reply.code(400).send({ error: 'Invalid protocol' });
    }
    // Sanitize port: digits, colon for ranges, comma for lists
    if (port && !/^[\d:,]+$/.test(port)) {
      return reply.code(400).send({ error: 'Invalid port' });
    }
    // Sanitize IP: basic CIDR/IP format
    if (from && from !== 'Anywhere' && !/^[\d.:/a-fA-F]+$/.test(from)) {
      return reply.code(400).send({ error: 'Invalid source IP' });
    }

    // Argümanlar dizi olarak geçtiği için tırnaklama/kaçırma gerekmiyor.
    const args = ['ufw', action];
    if (direction) args.push(direction);
    if (from && from !== 'Anywhere') args.push('from', from);
    if (port) {
      const portSuffix = proto && proto !== 'any' ? `${port}/${proto}` : String(port);
      if (from && from !== 'Anywhere') args.push('to', 'any', 'port', portSuffix);
      else args.push(portSuffix);
    }
    if (comment) {
      args.push('comment', String(comment).replace(/[\r\n]/g, ' ').slice(0, 60));
    }

    await hostOrThrow(args);
    invalidateStatus();
    fastify.log.info({ args }, 'UFW rule added');
    reply.send({ ok: true, cmd: args.join(' ') });
  });

  // ── Delete rule ─────────────────────────────────────────────────────────────
  fastify.delete('/api/firewall/rules/:num', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: MUTATING_RATE },
  }, async (req, reply) => {
    const num = parseInt(req.params.num, 10);
    if (!Number.isInteger(num) || num < 1) {
      return reply.code(400).send({ error: 'Invalid rule number' });
    }

    // Re-read rules to verify this isn't the SSH allow rule
    const [sshPort, { stdout }] = await Promise.all([
      getSshPort(),
      host(['ufw', 'status', 'numbered']),
    ]);
    const rule = parseUfwRules(stdout).find(r => r.num === num);

    if (!rule) return reply.code(404).send({ error: 'Rule not found' });
    if (isSshRule(rule, sshPort)) {
      return reply.code(403).send({ error: `Cannot delete SSH allow rule (port ${sshPort})` });
    }

    await hostOrThrow(['ufw', '--force', 'delete', String(num)]);
    invalidateStatus();
    fastify.log.info({ num }, 'UFW rule deleted');
    reply.send({ ok: true });
  });

  // ── Reset ───────────────────────────────────────────────────────────────────
  fastify.post('/api/firewall/reset', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const sshPort = await getSshPort();
    await host(['ufw', '--force', 'reset']);
    // Reset sonrası SSH ve panel kapıda kalmasın: kuralları hemen geri ekle.
    await host(['ufw', 'allow', `${sshPort}/tcp`, 'comment', 'SSH - re-added after reset']);
    for (const port of PANEL_PORTS) {
      await host(['ufw', 'allow', port, 'comment', 'ServerPanel - re-added after reset']);
    }
    invalidateStatus();
    fastify.log.info({ sshPort }, 'UFW reset');
    reply.send({ ok: true, sshPort });
  });
}
