import bcrypt from 'bcrypt';
import { config } from '../config.js';
import { logAuthEvent, readAuthEvents } from './logger.js';

// In-memory brute-force tracker: keyed by client IP.
// After MAX_FAILS failures the IP is locked for an escalating window.
const attempts = new Map();
const MAX_FAILS = 5;
const BASE_LOCK_MS = 15 * 60 * 1000; // 15 min, doubles each further lockout

function getState(ip) {
  let s = attempts.get(ip);
  if (!s) {
    s = { fails: 0, lockUntil: 0, lockCount: 0 };
    attempts.set(ip, s);
  }
  return s;
}

export async function authRoutes(fastify) {
  if (!config.adminPasswordHash) {
    fastify.log.error('ADMIN_PASSWORD_HASH ayarlı değil — login devre dışı. .env yapılandırın.');
  }

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
    const hash = config.adminPasswordHash || '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const passwordOk = await bcrypt.compare(password, hash);
    const valid = username === config.adminUsername && passwordOk && !!config.adminPasswordHash;

    if (!valid) {
      state.fails += 1;
      if (state.fails >= MAX_FAILS) {
        state.lockCount += 1;
        state.lockUntil = now + BASE_LOCK_MS * Math.pow(2, state.lockCount - 1);
        state.fails = 0;
        fastify.log.warn({ ip, lockCount: state.lockCount }, 'Login locked out (brute-force)');
      }
      logAuthEvent({ result: 'fail', username, ip, userAgent });
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Success — reset tracker for this IP.
    attempts.delete(ip);
    logAuthEvent({ result: 'success', username, ip, userAgent });

    const token = fastify.jwt.sign({ username }, { expiresIn: '24h' });

    reply
      .setCookie('sp_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 86400,
      })
      .send({ ok: true });
  });

  fastify.post('/api/auth/logout', async (req, reply) => {
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
