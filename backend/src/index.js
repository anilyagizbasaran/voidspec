import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';

import { config } from './config.js';
import { authRoutes } from './auth/routes.js';
import { authenticate } from './auth/middleware.js';
import { systemRoutes } from './system/routes.js';
import { fileRoutes } from './files/routes.js';
import { dockerRoutes } from './docker/routes.js';
import { terminalWs } from './terminal/ws.js';
import { dockerLogsWs } from './docker/logs.js';
import { processRoutes } from './processes/routes.js';
import { serviceRoutes } from './services/routes.js';
import { cronRoutes } from './cron/routes.js';
import { firewallRoutes } from './firewall/routes.js';
import { userRoutes } from './users/routes.js';
import { packageRoutes } from './packages/routes.js';
import { logRoutes } from './logs/routes.js';

// trustProxy: sadece iç ağdaki (Docker private) nginx'e güven. Böylece
// gerçek istemci IP'si X-Forwarded-For'dan doğru alınır ama dışarıdan gelen
// sahte X-Forwarded-For başlıkları (IP spoofing ile log/lockout atlatma)
// kabul edilmez.
const fastify = Fastify({ logger: true, trustProxy: 'uniquelocal' });

// Decorate authenticate
fastify.decorate('authenticate', authenticate);

await fastify.register(fastifyCors, {
  origin: config.allowedOrigin,
  credentials: true,
});

await fastify.register(fastifyCookie);

await fastify.register(fastifyJwt, {
  secret: config.jwtSecret,
  cookie: { cookieName: 'sp_token', signed: false },
});

await fastify.register(fastifyRateLimit, {
  global: false,
});

await fastify.register(fastifyMultipart, {
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

await fastify.register(fastifyWebsocket);

// Routes
await fastify.register(authRoutes);
await fastify.register(systemRoutes);
await fastify.register(fileRoutes);
await fastify.register(dockerRoutes);
await fastify.register(terminalWs);
await fastify.register(dockerLogsWs);
await fastify.register(processRoutes);
await fastify.register(serviceRoutes);
await fastify.register(cronRoutes);
await fastify.register(firewallRoutes);
await fastify.register(userRoutes);
await fastify.register(packageRoutes);
await fastify.register(logRoutes);

fastify.get('/health', async () => ({ ok: true }));

try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`ServerPanel backend running on port ${config.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
