import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function parseIntEnv(name, fallback) {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
}

const BCRYPT_RE = /^\$2[aby]\$\d{2}\$.{53}$/;

// docker compose, env_file içindeki `$$` dizisini `$` olarak okur; aynı dosya
// `node src/index.js` ile doğrudan çalıştırıldığında ise dotenv kaçırmayı
// çözmez ve hash sessizce geçersiz olur (her giriş "Invalid credentials").
// Kaçırılmış hash'i burada normalize ediyoruz.
function normalizeHash(raw) {
  if (!raw || BCRYPT_RE.test(raw)) return raw || '';
  const unescaped = raw.replace(/\$\$/g, '$');
  return BCRYPT_RE.test(unescaped) ? unescaped : raw;
}

export const config = {
  isProd,
  port: parseIntEnv('PORT', 3001),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPasswordHash: normalizeHash(process.env.ADMIN_PASSWORD_HASH),
  // Birden fazla origin virgülle ayrılabilir (ör. IP + alan adı).
  allowedOrigins: (process.env.ALLOWED_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  // TLS arkasında çalışırken cookie'yi Secure işaretle. NODE_ENV=production
  // ile otomatik açılır, COOKIE_SECURE ile elle geçersiz kılınabilir.
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : isProd,
  sshHost: process.env.SSH_HOST || '',
  sshUser: process.env.SSH_USER || 'root',
  maxTerminalSessions: parseIntEnv('MAX_TERMINAL_SESSIONS', 10),
  // Socket koptuktan sonra PTY'nin yeniden bağlanma için hayatta kalacağı süre.
  terminalReconnectMs: parseIntEnv('TERMINAL_RECONNECT_MS', 20 * 60 * 1000),
};

// ── Fail fast ────────────────────────────────────────────────────────────────
// Eksik/zayıf secret ile sessizce çalışmak, panelin root yetkisi düşünülünce
// kabul edilebilir değil: açılışta net hata verip duruyoruz.
const problems = [];

if (!config.jwtSecret) {
  problems.push('JWT_SECRET tanımlı değil.');
} else if (config.jwtSecret.length < 32) {
  problems.push(`JWT_SECRET çok kısa (${config.jwtSecret.length} karakter, en az 32 gerekli).`);
} else if (config.jwtSecret === 'change_this_secret' ||
           config.jwtSecret.includes('super_secret_random_string_change_this')) {
  problems.push('JWT_SECRET örnek değerde bırakılmış — `openssl rand -hex 32` ile yenisini üretin.');
}

if (!config.adminPasswordHash) {
  problems.push('ADMIN_PASSWORD_HASH tanımlı değil — düz metin parola desteklenmiyor.');
} else if (!BCRYPT_RE.test(config.adminPasswordHash)) {
  problems.push('ADMIN_PASSWORD_HASH geçerli bir bcrypt hash değil (bkz. .env.example).');
}

// Testlerde yalnızca saf yardımcı fonksiyonlar çalıştırılıyor; gerçek bir
// .env gerektirmesin.
if (problems.length && !isTest) {
  console.error('\n[config] ServerPanel başlatılamadı:\n' + problems.map(p => `  • ${p}`).join('\n') + '\n');
  process.exit(1);
}
