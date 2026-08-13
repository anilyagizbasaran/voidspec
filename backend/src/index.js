import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';

import { config } from './config.js';
import { authRoutes } from './auth/routes.js';
import { authenticate, isOriginAllowed } from './auth/middleware.js';
import { loadRevokedTokens } from './auth/tokens.js';
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
const fastify = Fastify({
  logger: true,
  trustProxy: 'uniquelocal',
  // Panel 2-5 saniyede bir yoklama yapıyor; her istek loglanınca docker
  // json-file log'u boş yere şişiyordu. Sadece hatalı ve yavaş istekleri
  // logluyoruz (aşağıdaki onResponse hook'u).
  disableRequestLogging: true,
});

// Decorate authenticate
fastify.decorate('authenticate', authenticate);

await fastify.register(fastifyCors, {
  origin: config.allowedOrigins,
  credentials: true,
});

await fastify.register(fastifyCookie);

await fastify.register(fastifyJwt, {
  secret: config.jwtSecret,
  cookie: { cookieName: 'sp_token', signed: false },
});

await fastify.register(fastifyRateLimit, {
  // Global taban limit: tek tek route'lar kendi (daha sıkı) limitlerini
  // config.rateLimit ile geçersiz kılabilir. Panel saniyede birkaç yoklama
  // yaptığı için taban bilerek yüksek — amaç normal kullanımı engellemek değil,
  // sınırsız istek atılmasını kesmek.
  max: 900,
  timeWindow: '1 minute',
});

await fastify.register(fastifyMultipart, {
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

await fastify.register(fastifyWebsocket);

// SameSite=strict cookie'nin yanında ikinci CSRF savunması: durum değiştiren
// isteklerde Origin ya yapılandırılmış listede olmalı ya da isteğin kendi
// host'u ile aynı olmalı.
fastify.addHook('onRequest', async (request, reply) => {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return;
  if (!isOriginAllowed(request)) {
    return reply.code(403).send({ error: 'Origin not allowed' });
  }
});

// Sadece hatalar ve yavaş istekler loglanır.
fastify.addHook('onResponse', async (request, reply) => {
  const ms = reply.elapsedTime;
  if (reply.statusCode >= 400 || ms > 1000) {
    request.log.warn({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      ms: Math.round(ms),
    }, 'request');
  }
});

await loadRevokedTokens();

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

fastify.get('/health', { config: { rateLimit: false } }, async () => ({ ok: true }));

// Kapatma sinyalinde açık PTY/stream'ler onClose hook'ları ile temizlenir.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    fastify.log.info({ signal }, 'Shutting down');
    try { await fastify.close(); } catch { /* zaten kapanıyor */ }
    process.exit(0);
  });
}

try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`ServerPanel backend running on port ${config.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
