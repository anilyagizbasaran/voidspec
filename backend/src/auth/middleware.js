import { config } from '../config.js';
import { isRevoked } from './tokens.js';

// Tarayıcıdan gelen istekte Origin, ya yapılandırılmış listede olmalı ya da
// isteğin kendi Host'u ile aynı olmalı (same-origin). SameSite=strict cookie'nin
// yanında ikinci bir CSRF savunması; WebSocket için ise tek savunma, çünkü
// WS handshake'i same-origin politikasına tabi değil.
export function isOriginAllowed(req) {
  const origin = req.headers?.origin;
  if (!origin) return true; // tarayıcı dışı istemci (curl, script) — cookie zaten gerekli
  if (config.allowedOrigins.includes(origin)) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// HTTP route'ları için onRequest hook'u.
export async function authenticate(request, reply) {
  try {
    // @fastify/jwt, cookie yapılandırması sayesinde token'ı sp_token
    // cookie'sinden (ya da Authorization header'ından) kendisi okur.
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  if (isRevoked(request.user?.jti)) {
    return reply.code(401).send({ error: 'Token revoked' });
  }
}

// WebSocket handshake'i için: cookie'deki token'ı doğrular, Origin'i kontrol
// eder. Başarılıysa payload döner, değilse null.
export function verifyWsAuth(fastify, req) {
  if (!isOriginAllowed(req)) return null;
  try {
    const token = req.cookies?.sp_token;
    if (!token) return null;
    const payload = fastify.jwt.verify(token);
    if (isRevoked(payload?.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

// WS route'larında tekrar eden reddetme kalıbı.
export function rejectWs(socket, message = 'Unauthorized') {
  try {
    socket.send(JSON.stringify({ type: 'error', data: message }));
  } catch {
    // socket zaten kapanmış olabilir
  }
  socket.close();
}
