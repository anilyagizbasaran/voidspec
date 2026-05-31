import bcrypt from 'bcrypt';
import { config } from '../config.js';

export async function authRoutes(fastify) {
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

    if (username !== config.adminUsername) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = config.adminPassword
      ? password === config.adminPassword
      : await bcrypt.compare(password, config.adminPasswordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = fastify.jwt.sign({ username }, { expiresIn: '24h' });

    reply
      .setCookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 86400,
      })
      .send({ ok: true });
  });

  fastify.post('/api/auth/logout', async (req, reply) => {
    reply.clearCookie('token', { path: '/' }).send({ ok: true });
  });

  fastify.get('/api/auth/me', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    reply.send({ username: req.user.username });
  });
}
