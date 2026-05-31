import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';

const NS = 'nsenter --mount=/proc/1/ns/mnt --';

function run(cmd) {
  try {
    return execSync(`${NS} ${cmd}`, { timeout: 8000 }).toString().trim();
  } catch (e) { return e.stdout?.toString().trim() || ''; }
}

function runOrThrow(cmd) {
  return execSync(`${NS} ${cmd}`, { timeout: 8000 }).toString().trim();
}

const USERNAME_RE = /^[a-z_][a-z0-9_-]{0,31}$/;

function validateUsername(name) {
  if (!name || !USERNAME_RE.test(name))
    throw { code: 400, message: 'Invalid username (lowercase letters, digits, dash, underscore; max 32 chars)' };
}

function parsePasswd() {
  const raw = run('getent passwd');
  return raw.split('\n').filter(Boolean).map(line => {
    const [username, , uid, gid, gecos, home, shell] = line.split(':');
    return { username, uid: parseInt(uid), gid: parseInt(gid), gecos, home, shell };
  });
}

function getUserGroups(username) {
  try {
    const out = run(`id -nG ${username}`);
    return out.split(' ').filter(Boolean);
  } catch { return []; }
}

function isLocked(username) {
  const out = run(`passwd -S ${username} 2>/dev/null`);
  return out.split(' ')[1] === 'L';
}

function getLastLogin(username) {
  try {
    const out = run(`last ${username} -n 3 --time-format iso 2>/dev/null`);
    return out.split('\n')
      .filter(l => l.startsWith(username))
      .map(l => {
        const parts = l.trim().split(/\s+/);
        return { from: parts[2] || '', date: parts[3] || '' };
      });
  } catch { return []; }
}

// UIDs to always exclude
const EXCLUDED_UIDS = new Set([65534]); // nobody

// Shells that indicate interactive users
const LOGIN_SHELLS = ['/bin/bash', '/bin/sh', '/bin/zsh', '/bin/fish', '/usr/bin/bash', '/usr/bin/zsh'];

function isInteractive(user) {
  if (EXCLUDED_UIDS.has(user.uid)) return false;
  return user.uid === 0 || user.uid >= 1000 || LOGIN_SHELLS.includes(user.shell);
}

// ─────────────────────────────────────────────────────────────────────────────
export async function userRoutes(fastify) {

  // List users
  fastify.get('/api/users', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const all = parsePasswd().filter(isInteractive);
    const users = all.map(u => ({
      ...u,
      groups:  getUserGroups(u.username),
      locked:  isLocked(u.username),
      lastLogin: getLastLogin(u.username)[0] || null,
    }));
    reply.send({ users });
  });

  // User detail
  fastify.get('/api/users/:username', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { username } = req.params;
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }

    const all = parsePasswd();
    const user = all.find(u => u.username === username);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const sshKeys = getSSHKeys(username, user.home);
    const logins  = getLastLogin(username);

    reply.send({
      ...user,
      groups:   getUserGroups(username),
      locked:   isLocked(username),
      sshKeys,
      logins,
    });
  });

  // Create user
  fastify.post('/api/users', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const { username, password, shell = '/bin/bash', sudo: wantSudo = false, comment = '' } = req.body || {};
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
    if (!password || password.length < 8)
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });

    const existing = parsePasswd().find(u => u.username === username);
    if (existing) return reply.code(409).send({ error: 'Username already exists' });

    const safeShell  = LOGIN_SHELLS.includes(shell) ? shell : '/bin/bash';
    const safeComment = comment.replace(/[:']/g, '').slice(0, 60);

    runOrThrow(`useradd -m -s ${safeShell}${safeComment ? ` -c '${safeComment}'` : ''} ${username}`);
    runOrThrow(`bash -c "echo '${username}:${password.replace(/'/g, "\\'")}' | chpasswd"`);
    if (wantSudo) runOrThrow(`usermod -aG sudo ${username}`);

    fastify.log.info({ username }, 'User created');
    reply.send({ ok: true });
  });

  // Delete user
  fastify.delete('/api/users/:username', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const { username } = req.params;
    const { removeHome = false } = req.query;
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
    if (username === 'root') return reply.code(403).send({ error: 'Cannot delete root' });

    const user = parsePasswd().find(u => u.username === username);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    runOrThrow(`userdel${removeHome === 'true' ? ' -r' : ''} ${username}`);
    fastify.log.info({ username, removeHome }, 'User deleted');
    reply.send({ ok: true });
  });

  // Change password
  fastify.post('/api/users/:username/password', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    const { username } = req.params;
    const { password } = req.body || {};
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
    if (!password || password.length < 8)
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });

    runOrThrow(`bash -c "echo '${username}:${password.replace(/'/g, "\\'")}' | chpasswd"`);
    fastify.log.info({ username }, 'Password changed');
    reply.send({ ok: true });
  });

  // Lock / unlock
  fastify.post('/api/users/:username/lock', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { username } = req.params;
    const { lock } = req.body || {};
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
    if (username === 'root') return reply.code(403).send({ error: 'Cannot lock root' });

    runOrThrow(`passwd ${lock ? '-l' : '-u'} ${username}`);
    fastify.log.info({ username, lock }, 'User lock toggled');
    reply.send({ ok: true });
  });

  // SSH key endpoints
  fastify.get('/api/users/:username/ssh-keys', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { username } = req.params;
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
    const user = parsePasswd().find(u => u.username === username);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    reply.send({ keys: getSSHKeys(username, user.home) });
  });

  fastify.post('/api/users/:username/ssh-keys', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 20, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    const { username } = req.params;
    const { key } = req.body || {};
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
    if (!key || !isValidSSHKey(key))
      return reply.code(400).send({ error: 'Invalid SSH public key' });

    const user = parsePasswd().find(u => u.username === username);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const sshDir  = `${user.home}/.ssh`;
    const authFile = `${sshDir}/authorized_keys`;
    run(`mkdir -p ${sshDir}`);
    run(`chmod 700 ${sshDir}`);
    run(`touch ${authFile}`);
    run(`chmod 600 ${authFile}`);

    // Append key via tee
    const safeKey = key.replace(/'/g, '').trim();
    runOrThrow(`bash -c "echo '${safeKey}' >> ${authFile}"`);
    run(`chown -R ${username}:${username} ${sshDir}`);

    fastify.log.info({ username }, 'SSH key added');
    reply.send({ ok: true });
  });

  fastify.delete('/api/users/:username/ssh-keys/:idx', {
    onRequest: [fastify.authenticate],
  }, async (req, reply) => {
    const { username } = req.params;
    const idx = parseInt(req.params.idx, 10);
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }

    const user = parsePasswd().find(u => u.username === username);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const authFile = `${user.home}/.ssh/authorized_keys`;
    const keys = getSSHKeys(username, user.home);
    if (idx < 0 || idx >= keys.length) return reply.code(404).send({ error: 'Key not found' });

    const remaining = keys.filter((_, i) => i !== idx).map(k => k.raw);
    run(`bash -c "printf '%s\n' ${remaining.map(k => `'${k.replace(/'/g,'')}'`).join(' ')} > ${authFile}"`);

    fastify.log.info({ username, idx }, 'SSH key deleted');
    reply.send({ ok: true });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getSSHKeys(username, home) {
  try {
    const authFile = `${home}/.ssh/authorized_keys`;
    const raw = run(`cat ${authFile} 2>/dev/null`);
    return raw.split('\n').filter(Boolean).map((line, idx) => {
      const parts = line.trim().split(/\s+/);
      return {
        idx,
        type:    parts[0] || '',
        key:     parts[1] ? parts[1].slice(0, 32) + '…' : '',
        comment: parts.slice(2).join(' ') || '',
        raw:     line.trim(),
      };
    });
  } catch { return []; }
}

const SSH_KEY_TYPES = ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'sk-ssh-ed25519@openssh.com'];

function isValidSSHKey(key) {
  const parts = key.trim().split(/\s+/);
  return parts.length >= 2 && SSH_KEY_TYPES.includes(parts[0]);
}
