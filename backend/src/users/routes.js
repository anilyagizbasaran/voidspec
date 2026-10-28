import { host, hostOrThrow, hostInput } from '../lib/host.js';

const USERNAME_RE = /^[a-z_][a-z0-9_-]{0,31}$/;

export function validateUsername(name) {
  if (!name || !USERNAME_RE.test(name))
    throw { code: 400, message: 'Invalid username (lowercase letters, digits, dash, underscore; max 32 chars)' };
}

// chpasswd stdin'den `kullanıcı:parola` satırları okuyor. Parolada satır sonu
// olursa ikinci satır başka bir kullanıcının (root dahil) parolasını
// değiştiriyordu.
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8)
    throw { code: 400, message: 'Password must be at least 8 characters' };
  if (/[\r\n\0]/.test(password))
    throw { code: 400, message: 'Password cannot contain line breaks' };
}

// Kullanıcı başına 3 host komutu çalışıyor; hepsini aynı anda başlatmak büyük
// makinelerde yüzlerce süreç demek. Aynı anda en fazla LIMIT kadar iş.
const LIMIT = 8;
async function mapLimit(items, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(LIMIT, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function parsePasswd() {
  const { stdout: raw } = await host(['getent', 'passwd']);
  return raw.split('\n').filter(Boolean).map(line => {
    const [username, , uid, gid, gecos, home, shell] = line.split(':');
    return { username, uid: parseInt(uid), gid: parseInt(gid), gecos, home, shell };
  });
}

async function getUserGroups(username) {
  const { stdout } = await host(['id', '-nG', username]);
  return stdout.split(' ').filter(Boolean);
}

async function isLocked(username) {
  const { stdout } = await host(['passwd', '-S', username]);
  return stdout.split(' ')[1] === 'L';
}

async function getLastLogin(username) {
  const { stdout: out } = await host(['last', username, '-n', '3', '--time-format', 'iso']);
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

// Liste 30 saniyede bir yoklanıyor ama kullanıcı tablosu neredeyse hiç
// değişmiyor; kısa cache ile gereksiz host komutlarını kesiyoruz.
const LIST_TTL_MS = 10000;
let listCache = { at: 0, data: null };
let listInFlight = null;

async function collectUsers() {
  const all = (await parsePasswd()).filter(isInteractive);
  return mapLimit(all, async (u) => {
    const [groups, locked, logins] = await Promise.all([
      getUserGroups(u.username),
      isLocked(u.username),
      getLastLogin(u.username),
    ]);
    return { ...u, groups, locked, lastLogin: logins[0] || null };
  });
}

function invalidateList() {
  listCache = { at: 0, data: null };
}

async function getUsers() {
  if (listCache.data && Date.now() - listCache.at < LIST_TTL_MS) return listCache.data;
  if (!listInFlight) {
    listInFlight = collectUsers()
      .then(data => {
        listCache = { at: Date.now(), data };
        return data;
      })
      .finally(() => { listInFlight = null; });
  }
  return listInFlight;
}

async function findUser(username) {
  return (await parsePasswd()).find(u => u.username === username);
}

// ─────────────────────────────────────────────────────────────────────────────
export async function userRoutes(fastify) {

  // List users
  fastify.get('/api/users', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    reply.send({ users: await getUsers() });
  });

  // User detail
  fastify.get('/api/users/:username', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { username } = req.params;
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }

    const user = await findUser(username);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const [groups, locked, sshKeys, logins] = await Promise.all([
      getUserGroups(username),
      isLocked(username),
      getSSHKeys(user.home).catch(() => []),
      getLastLogin(username),
    ]);

    reply.send({ ...user, groups, locked, sshKeys, logins });
  });

  // Create user
  fastify.post('/api/users', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const { username, password, shell = '/bin/bash', sudo: wantSudo = false, comment = '' } = req.body || {};
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
    try { validatePassword(password); } catch (e) { return reply.code(e.code).send({ error: e.message }); }

    if (await findUser(username)) return reply.code(409).send({ error: 'Username already exists' });

    const safeShell = LOGIN_SHELLS.includes(shell) ? shell : '/bin/bash';
    // Argümanlar shell'den geçmediği için tırnak kaçırmaya gerek yok; sadece
    // passwd dosyasının alan ayracını ve satır sonlarını temizliyoruz.
    const safeComment = String(comment).replace(/[:\r\n]/g, '').slice(0, 60);

    const args = ['useradd', '-m', '-s', safeShell];
    if (safeComment) args.push('-c', safeComment);
    args.push(username);

    await hostOrThrow(args);
    await hostInput(['chpasswd'], `${username}:${password}\n`);
    if (wantSudo) await hostOrThrow(['usermod', '-aG', 'sudo', username]);

    invalidateList();
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

    if (!await findUser(username)) return reply.code(404).send({ error: 'User not found' });

    await hostOrThrow(removeHome === 'true' ? ['userdel', '-r', username] : ['userdel', username]);
    invalidateList();
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
    try { validatePassword(password); } catch (e) { return reply.code(e.code).send({ error: e.message }); }

    if (!await findUser(username)) return reply.code(404).send({ error: 'User not found' });

    await hostInput(['chpasswd'], `${username}:${password}\n`);
    fastify.log.info({ username }, 'Password changed');
    reply.send({ ok: true });
  });

  // Lock / unlock
  fastify.post('/api/users/:username/lock', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { username } = req.params;
    const { lock } = req.body || {};
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
    if (username === 'root') return reply.code(403).send({ error: 'Cannot lock root' });

    await hostOrThrow(['passwd', lock ? '-l' : '-u', username]);
    invalidateList();
    fastify.log.info({ username, lock }, 'User lock toggled');
    reply.send({ ok: true });
  });

  // SSH key endpoints
  fastify.get('/api/users/:username/ssh-keys', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { username } = req.params;
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }
    const user = await findUser(username);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    reply.send({ keys: await getSSHKeys(user.home) });
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

    const user = await findUser(username);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const sshDir = `${user.home}/.ssh`;
    const authFile = `${sshDir}/authorized_keys`;

    const existingKeys = await getSSHKeys(user.home);
    if (existingKeys.some(k => k.raw === key.trim())) {
      return reply.code(409).send({ error: 'SSH key already exists' });
    }

    await host(['mkdir', '-p', sshDir]);
    await host(['chmod', '700', sshDir]);
    await writeAuthorizedKeys(authFile, [...existingKeys.map(k => k.raw), key.trim()]);
    await host(['chown', '-R', `${username}:${username}`, sshDir]);

    fastify.log.info({ username }, 'SSH key added');
    reply.send({ ok: true });
  });

  fastify.delete('/api/users/:username/ssh-keys/:idx', {
    onRequest: [fastify.authenticate],
  }, async (req, reply) => {
    const { username } = req.params;
    const idx = parseInt(req.params.idx, 10);
    try { validateUsername(username); } catch (e) { return reply.code(e.code).send({ error: e.message }); }

    const user = await findUser(username);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const keys = await getSSHKeys(user.home);
    if (isNaN(idx) || idx < 0 || idx >= keys.length) return reply.code(404).send({ error: 'Key not found' });

    await writeAuthorizedKeys(
      `${user.home}/.ssh/authorized_keys`,
      keys.filter((_, i) => i !== idx).map(k => k.raw),
    );

    fastify.log.info({ username, idx }, 'SSH key deleted');
    reply.send({ ok: true });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// Dosya yoksa anahtar da yok; başka bir okuma hatasında fırlatıyoruz. Aksi
// halde anahtar eklerken mevcut liste boş sanılıp authorized_keys yalnızca
// yeni anahtarla yeniden yazılıyor, eski erişimler kayboluyordu.
export function sshKeysRaw({ ok, stdout, stderr }) {
  if (ok) return stdout;
  if (/No such file or directory/i.test(stderr)) return '';
  const err = new Error(`could not read authorized_keys: ${stderr || 'unknown error'}`);
  err.statusCode = 503;
  throw err;
}

async function getSSHKeys(home) {
  const raw = sshKeysRaw(await host(['cat', `${home}/.ssh/authorized_keys`]));
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
async function writeAuthorizedKeys(authFile, keys) {
  const content = keys.filter(Boolean).join('\n');
  await hostInput(['tee', authFile], content ? content + '\n' : '');
  await host(['chmod', '600', authFile]);
}

const SSH_KEY_TYPES = ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'sk-ssh-ed25519@openssh.com'];

export function isValidSSHKey(key) {
  const parts = key.trim().split(/\s+/);
  // Anahtar tek satır olmalı; çok satırlı girdi ile ek satır enjekte edilemesin.
  if (key.includes('\n') || key.includes('\r')) return false;
  return parts.length >= 2 && SSH_KEY_TYPES.includes(parts[0]) && /^[A-Za-z0-9+/=]+$/.test(parts[1]);
}
