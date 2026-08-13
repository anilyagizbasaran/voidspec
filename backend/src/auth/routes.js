import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { logAuthEvent, readAuthEvents } from './logger.js';
import { revokeToken } from './tokens.js';

// In-memory brute-force tracker: keyed by client IP.
// After MAX_FAILS failures the IP is locked for an escalating window.
const attempts = new Map();
const MAX_FAILS = 5;
const BASE_LOCK_MS = 15 * 60 * 1000; // 15 min, doubles each further lockout
// Üst sınır olmadan katlanan süre 20. kilitlenmede yıllara çıkıyordu: ortak
// bir NAT/CGNAT IP'sinden gelen gürültü yöneticiyi kalıcı olarak dışarıda
// bırakabilirdi. Tavan koyuyoruz.
const MAX_LOCK_MS = 24 * 60 * 60 * 1000; // 24 saat
// Kilitlenme sayacı da sonsuza kadar hatırlanmamalı; bu süre boyunca hiç
// başarısız deneme gelmezse ceza kademesi bir basamak geri iner.
const LOCK_DECAY_MS = 12 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const ENTRY_TTL_MS = 60 * 60 * 1000; // son hareketten 1 saat sonra kaydı unut

export function lockDurationMs(lockCount) {
  const scaled = BASE_LOCK_MS * Math.pow(2, Math.max(0, lockCount - 1));
  // 2^n hızla Infinity'ye gidiyor; Math.min ile tavanlıyoruz.
  return Math.min(scaled, MAX_LOCK_MS);
}

function getState(ip) {
  let s = attempts.get(ip);
  if (!s) {
    s = { fails: 0, lockUntil: 0, lockCount: 0, seen: Date.now() };
    attempts.set(ip, s);
  }
  s.seen = Date.now();
  return s;
}

// Kilidi bitmiş ve uzun süredir hareketsiz kayıtları temizle. Aksi halde
// dağıtık deneme altında Map sınırsız büyüyordu.
function sweepAttempts() {
  const now = Date.now();
  for (const [ip, s] of attempts) {
    if (s.lockUntil <= now && now - s.seen > ENTRY_TTL_MS) {
      attempts.delete(ip);
      continue;
    }
    // Uzun süredir sessiz olan IP'nin ceza kademesini geri indir, yoksa
    // aylar önceki kilitlenmeler yüzünden süre hep tavanda kalıyor.
    if (s.lockCount > 0 && s.lockUntil <= now && now - s.seen > LOCK_DECAY_MS) {
      s.lockCount -= 1;
      s.seen = now;
    }
  }
}

export async function authRoutes(fastify) {
  const sweepTimer = setInterval(sweepAttempts, SWEEP_INTERVAL_MS);
  sweepTimer.unref();
  fastify.addHook('onClose', async () => clearInterval(sweepTimer));

  fastify.post('/api/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { username, password } = req.body;
    // nginx X-Real-IP'yi her seferinde gerçek $remote_addr ile yazar (spoof
    // edilemez); tek proxy hop olduğu için otoriter istemci IP'si budur.
    const ip = req.headers['x-real-ip'] || req.ip;
    const userAgent = req.headers['user-agent'];
    const state = getState(ip);
    const now = Date.now();

    // Locked out?
    if (state.lockUntil > now) {
      const retryAfter = Math.ceil((state.lockUntil - now) / 1000);
      reply.header('Retry-After', retryAfter);
      logAuthEvent({ result: 'locked', username, ip, userAgent });
      return reply.code(429).send({
        error: 'Too many failed attempts',
        retryAfterSeconds: retryAfter,
      });
    }

    // Always run bcrypt against a hash (constant-time) even on username
    // mismatch, so timing can't reveal whether the username was valid.
    const passwordOk = await bcrypt.compare(password, config.adminPasswordHash);
    const valid = username === config.adminUsername && passwordOk;

    if (!valid) {
      state.fails += 1;
      if (state.fails >= MAX_FAILS) {
        state.lockCount += 1;
        state.lockUntil = now + lockDurationMs(state.lockCount);
        state.fails = 0;
        fastify.log.warn({ ip, lockCount: state.lockCount }, 'Login locked out (brute-force)');
      }
      logAuthEvent({ result: 'fail', username, ip, userAgent });
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Success — reset tracker for this IP.
    attempts.delete(ip);
    logAuthEvent({ result: 'success', username, ip, userAgent });

    // jti: logout'ta token'ı iptal edebilmek için benzersiz kimlik.
    const token = fastify.jwt.sign(
      { username, jti: randomUUID() },
      { expiresIn: config.jwtExpiresIn },
    );

    reply
      .setCookie('sp_token', token, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: 'strict',
        path: '/',
        // Token ile aynı ömür — bkz. config.durationToSeconds
        maxAge: config.jwtExpiresInSeconds,
      })
      .send({ ok: true });
  });

  fastify.post('/api/auth/logout', async (req, reply) => {
    // Cookie'yi silmek yetmiyor: token 24 saat daha geçerli kalıyordu.
    // jti'yi iptal listesine alıyoruz.
    try {
      const token = req.cookies?.sp_token;
      if (token) {
        const payload = fastify.jwt.verify(token);
        await revokeToken(payload.jti, payload.exp);
      }
    } catch {
      // Token zaten geçersiz/süresi dolmuş — iptal edilecek bir şey yok.
    }
    reply.clearCookie('sp_token', { path: '/' }).send({ ok: true });
  });

  fastify.get('/api/auth/history', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const limit = Math.min(parseInt(req.query?.limit, 10) || 200, 1000);
    const events = await readAuthEvents(limit);
    reply.send({ events });
  });

  fastify.get('/api/auth/me', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    reply.send({ username: req.user.username });
  });
}
