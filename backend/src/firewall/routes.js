import { hostSync, hostSyncOrThrow } from '../lib/host.js';

// Detect SSH port from sshd config
function getSshPort() {
  const out = hostSync(['sshd', '-T']);
  const m = out.match(/^port (\d+)/m);
  if (m) return parseInt(m[1]);

  const conf = hostSync(['cat', '/etc/ssh/sshd_config']);
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

export async function firewallRoutes(fastify) {
  // ── Status ──────────────────────────────────────────────────────────────────
  fastify.get('/api/firewall/status', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const statusRaw = hostSync(['ufw', 'status', 'verbose']);
    const active = /Status:\s*active/i.test(statusRaw);
    const rulesRaw = hostSync(['ufw', 'status', 'numbered']);
    const rules = parseUfwRules(rulesRaw);
    const sshPort = getSshPort();

    reply.send({
      active,
      sshPort,
      sshProtected: rules.some(r => isSshRule(r, sshPort)),
      rules,
      iptables: {
        input:  parseIptables(hostSync(['iptables', '-L', 'INPUT', '--line-numbers', '-n'])),
        output: parseIptables(hostSync(['iptables', '-L', 'OUTPUT', '--line-numbers', '-n'])),
      },
      raw: active ? rulesRaw : statusRaw,
    });
  });

  // ── Enable UFW ──────────────────────────────────────────────────────────────
  fastify.post('/api/firewall/enable', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: MUTATING_RATE },
  }, async (req, reply) => {
    const sshPort = getSshPort();
    const rules = parseUfwRules(hostSync(['ufw', 'status', 'numbered']));

    // Always ensure SSH is allowed before enabling
    const sshAllowed = rules.some(r => isSshRule(r, sshPort));
    if (!sshAllowed) {
      hostSync(['ufw', 'allow', `${sshPort}/tcp`, 'comment', 'SSH - auto-added by ServerPanel']);
    }

    // Always ensure panel ports are allowed before enabling
    hostSync(['ufw', 'allow', '80/tcp', 'comment', 'ServerPanel HTTP']);
    hostSync(['ufw', 'allow', '3001/tcp', 'comment', 'ServerPanel Backend']);

    hostSyncOrThrow(['ufw', '--force', 'enable']);
    fastify.log.info('UFW enabled');
    reply.send({ ok: true, sshAutoAdded: !sshAllowed, sshPort });
  });

  // ── Disable UFW ─────────────────────────────────────────────────────────────
  fastify.post('/api/firewall/disable', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: MUTATING_RATE },
  }, async (req, reply) => {
    hostSyncOrThrow(['ufw', '--force', 'disable']);
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

    hostSyncOrThrow(args);
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
    const sshPort = getSshPort();
    const rule = parseUfwRules(hostSync(['ufw', 'status', 'numbered'])).find(r => r.num === num);

    if (!rule) return reply.code(404).send({ error: 'Rule not found' });
    if (isSshRule(rule, sshPort)) {
      return reply.code(403).send({ error: `Cannot delete SSH allow rule (port ${sshPort})` });
    }

    hostSyncOrThrow(['ufw', '--force', 'delete', String(num)]);
    fastify.log.info({ num }, 'UFW rule deleted');
    reply.send({ ok: true });
  });

  // ── Reset ───────────────────────────────────────────────────────────────────
  fastify.post('/api/firewall/reset', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    hostSync(['ufw', '--force', 'reset']);
    // Reset sonrası SSH kapıda kalmasın: kuralı hemen geri ekle.
    const sshPort = getSshPort();
    hostSync(['ufw', 'allow', `${sshPort}/tcp`, 'comment', 'SSH - re-added after reset']);
    fastify.log.info({ sshPort }, 'UFW reset');
    reply.send({ ok: true, sshPort });
  });
}
