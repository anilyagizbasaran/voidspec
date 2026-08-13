import { hostSync, hostSyncOrThrow, hostWithInput } from '../lib/host.js';

const USERNAME_RE = /^[a-z_][a-z0-9_-]{0,31}$/;

export function validateUsername(name) {
  if (!name || !USERNAME_RE.test(name))
    throw { code: 400, message: 'Invalid username (lowercase letters, digits, dash, underscore; max 32 chars)' };
}

function parsePasswd() {
  const raw = hostSync(['getent', 'passwd']);
  return raw.split('\n').filter(Boolean).map(line => {
    const [username, , uid, gid, gecos, home, shell] = line.split(':');
    return { username, uid: parseInt(uid), gid: parseInt(gid), gecos, home, shell };
  });
}

function getUserGroups(username) {
  return hostSync(['id', '-nG', username]).split(' ').filter(Boolean);
}

function isLocked(username) {
  return hostSync(['passwd', '-S', username]).split(' ')[1] === 'L';
}

function getLastLogin(username) {
  const out = hostSync(['last', username, '-n', '3', '--time-format', 'iso']);
  return out.split('\n')
    .filter(l => l.startsWith(username))
    .map(l => {
      const parts = l.trim().split(/\s+/);
      return { from: parts[2] || '', date: parts[3] || '' };
    });
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

    reply.send({
      ...user,
      groups:   getUserGroups(username),
      locked:   isLocked(username),
      sshKeys:  getSSHKeys(user.home),
      logins:   getLastLogin(username),
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

    const safeShell = LOGIN_SHELLS.includes(shell) ? shell : '/bin/bash';
    // Argümanlar shell'den geçmediği için tırnak kaçırmaya gerek yok; sadece
    // passwd dosyasının alan ayracını ve satır sonlarını temizliyoruz.
    const safeComment = String(comment).replace(/[:\r\n]/g, '').slice(0, 60);

    const args = ['useradd', '-m', '-s', safeShell];
    if (safeComment) args.push('-c', safeComment);
    args.push(username);

    hostSyncOrThrow(args);
    hostWithInput(['chpasswd'], `${username}:${password}\n`);
    if (wantSudo) hostSyncOrThrow(['usermod', '-aG', 'sudo', username]);

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

    hostSyncOrThrow(removeHome === 'true' ? ['userdel', '-r', username] : ['userdel', username]);
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

    const user = parsePasswd().find(u => u.username === username);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    hostWithInput(['chpasswd'], `${username}:${password}\n`);
    fastify.log.info({ username }, 'Password changed');
    reply.send({ ok: true });
  });

  // Lock / unlock
  fastify.post('/api/users/:username/lock', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { username } = req.params;
    const { lock } = req.body || {};
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
    if (username === 'root') return reply.code(403).send({ error: 'Cannot lock root' });

    hostSyncOrThrow(['passwd', lock ? '-l' : '-u', username]);
    fastify.log.info({ username, lock }, 'User lock toggled');
    reply.send({ ok: true });
  });

  // SSH key endpoints
  fastify.get('/api/users/:username/ssh-keys', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { username } = req.params;
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
    const user = parsePasswd().find(u => u.username === username);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    reply.send({ keys: getSSHKeys(user.home) });
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

    const sshDir = `${user.home}/.ssh`;
    const authFile = `${sshDir}/authorized_keys`;

    const existingKeys = getSSHKeys(user.home);
    if (existingKeys.some(k => k.raw === key.trim())) {
      return reply.code(409).send({ error: 'SSH key already exists' });
    }

    hostSync(['mkdir', '-p', sshDir]);
    hostSync(['chmod', '700', sshDir]);
    writeAuthorizedKeys(authFile, [...existingKeys.map(k => k.raw), key.trim()]);
    hostSync(['chown', '-R', `${username}:${username}`, sshDir]);

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

    const keys = getSSHKeys(user.home);
    if (isNaN(idx) || idx < 0 || idx >= keys.length) return reply.code(404).send({ error: 'Key not found' });

    writeAuthorizedKeys(
      `${user.home}/.ssh/authorized_keys`,
      keys.filter((_, i) => i !== idx).map(k => k.raw),
    );

    fastify.log.info({ username, idx }, 'SSH key deleted');
    reply.send({ ok: true });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getSSHKeys(home) {
  const raw = hostSync(['cat', `${home}/.ssh/authorized_keys`]);
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
}

// authorized_keys içeriğini stdin üzerinden yazar.
//
// Eskiden bu iş `bash -c "printf '%s\n' 'key' > dosya"` şeklinde, üstelik dış
// bir shell'den geçerek yapılıyordu: bir anahtarın yorum alanındaki $(...) veya
// backtick, dosya yazılırken komut olarak çalışıyordu. Artık içerik hiçbir
// shell'den geçmiyor.
function writeAuthorizedKeys(authFile, keys) {
  const content = keys.filter(Boolean).join('\n');
  hostWithInput(['tee', authFile], content ? content + '\n' : '', {
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  hostSync(['chmod', '600', authFile]);
}

const SSH_KEY_TYPES = ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'sk-ssh-ed25519@openssh.com'];

export function isValidSSHKey(key) {
  const parts = key.trim().split(/\s+/);
  // Anahtar tek satır olmalı; çok satırlı girdi ile ek satır enjekte edilemesin.
  if (key.includes('\n') || key.includes('\r')) return false;
  return parts.length >= 2 && SSH_KEY_TYPES.includes(parts[0]) && /^[A-Za-z0-9+/=]+$/.test(parts[1]);
}
