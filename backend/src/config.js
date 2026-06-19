import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  sshHost: process.env.SSH_HOST || '',
  sshUser: process.env.SSH_USER || 'root',
};
