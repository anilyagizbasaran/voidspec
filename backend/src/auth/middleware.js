export async function authenticate(request, reply) {
  try {
    const token = request.cookies?.token;
    if (!token) throw new Error('No token');
    await request.jwtVerify({ onlyCookie: false });
  } catch {
    // Try cookie manually
    try {
      const token = request.cookies?.token;
      if (!token) throw new Error('No token');
      const decoded = request.server.jwt.verify(token);
      request.user = decoded;
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  }
}
