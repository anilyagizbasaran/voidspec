import { execSync } from 'child_process';

const NS = 'nsenter --mount=/proc/1/ns/mnt --';

function run(cmd, opts = {}) {
  try {
    return execSync(`${NS} ${cmd}`, { timeout: 10000, ...opts }).toString().trim();
  } catch (e) {
    return e.stdout?.toString().trim() || '';
  }
}

function runOrThrow(cmd) {
  return execSync(`${NS} ${cmd}`, { timeout: 10000 }).toString().trim();
}

// Detect SSH port from sshd config
function getSshPort() {
  try {
    const out = run('sshd -T 2>/dev/null');
    const m = out.match(/^port (\d+)/m);
    if (m) return parseInt(m[1]);
  } catch {}
  try {
    const conf = run("grep -E '^Port ' /etc/ssh/sshd_config");
    const m = conf.match(/Port\s+(\d+)/);
    if (m) return parseInt(m[1]);
  } catch {}
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

const MUTATING_RATE = { max: 15, timeWindow: '1 minute' };

export async function firewallRoutes(fastify) {
  // ── Status ──────────────────────────────────────────────────────────────────
  fastify.get('/api/firewall/status', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const statusRaw = run('ufw status verbose');
    const active = /Status:\s*active/i.test(statusRaw);
    const rulesRaw = run('ufw status numbered');
    const rules = parseUfwRules(rulesRaw);

    const iptInput  = run('iptables -L INPUT --line-numbers -n 2>/dev/null');
    const iptOutput = run('iptables -L OUTPUT --line-numbers -n 2>/dev/null');

    const sshPort = getSshPort();
    const sshProtected = rules.some(r =>
      r.action === 'ALLOW' &&
      (r.to === String(sshPort) || r.to.startsWith(`${sshPort}/`) || r.to === 'OpenSSH')
    );

    reply.send({
      active,
      sshPort,
      sshProtected,
      rules,
      iptables: {
        input:  parseIptables(iptInput),
        output: parseIptables(iptOutput),
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
    const rulesRaw = run('ufw status numbered');
    const rules = parseUfwRules(rulesRaw);

    // Always ensure SSH is allowed before enabling
    const sshAllowed = rules.some(r =>
      r.action === 'ALLOW' &&
      (r.to === String(sshPort) || r.to.startsWith(`${sshPort}/`) || r.to === 'OpenSSH')
    );

    if (!sshAllowed) {
      run(`ufw allow ${sshPort}/tcp comment 'SSH - auto-added by ServerPanel'`);
    }

    // Always ensure panel ports are allowed before enabling
    run(`ufw allow 80/tcp comment 'ServerPanel HTTP'`);
    run(`ufw allow 3001/tcp comment 'ServerPanel Backend'`);

    runOrThrow('ufw --force enable');
    fastify.log.info('UFW enabled');
    reply.send({ ok: true, sshAutoAdded: !sshAllowed, sshPort });
  });

  // ── Disable UFW ─────────────────────────────────────────────────────────────
  fastify.post('/api/firewall/disable', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: MUTATING_RATE },
  }, async (req, reply) => {
    runOrThrow('ufw --force disable');
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
    if (from && !/^[\d.:\/a-fA-F]+$/.test(from) && from !== 'Anywhere') {
      return reply.code(400).send({ error: 'Invalid source IP' });
    }

    // Build command
    let cmd = `ufw ${action}`;
    if (direction) cmd += ` ${direction}`;
    if (from && from !== 'Anywhere') cmd += ` from ${from}`;
    if (port) {
      const portSuffix = proto && proto !== 'any' ? `${port}/${proto}` : port;
      if (from && from !== 'Anywhere') {
        cmd += ` to any port ${portSuffix}`;
      } else {
        cmd += ` ${portSuffix}`;
      }
    }
    if (comment) {
      // Sanitize comment: allow only printable non-quote chars
      const safeComment = comment.replace(/['"\\]/g, '').slice(0, 60);
      cmd += ` comment '${safeComment}'`;
    }

    runOrThrow(cmd);
    fastify.log.info({ cmd }, 'UFW rule added');
    reply.send({ ok: true, cmd });
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
    const rulesRaw = run('ufw status numbered');
    const rules = parseUfwRules(rulesRaw);
    const rule = rules.find(r => r.num === num);

    if (!rule) return reply.code(404).send({ error: 'Rule not found' });

    const isSshAllow = rule.action === 'ALLOW' && (
      rule.to === String(sshPort) ||
      rule.to.startsWith(`${sshPort}/`) ||
      rule.to === 'OpenSSH'
    );

    if (isSshAllow) {
      return reply.code(403).send({ error: `Cannot delete SSH allow rule (port ${sshPort})` });
    }

    runOrThrow(`ufw --force delete ${num}`);
    fastify.log.info({ num }, 'UFW rule deleted');
    reply.send({ ok: true });
  });

  // ── Reset ───────────────────────────────────────────────────────────────────
  fastify.post('/api/firewall/reset', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    run('ufw --force reset');
    fastify.log.info('UFW reset');
    reply.send({ ok: true });
  });
}
