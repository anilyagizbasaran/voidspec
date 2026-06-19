import { appendFile, mkdir, readFile } from 'fs/promises';
import { dirname } from 'path';

// Giriş denemeleri kalıcı dosyaya yazılır. /root container'a mount edildiği
// için host'tan da okunabilir: /root/serverpanel/backend/logs/auth.log
const LOG_FILE = process.env.AUTH_LOG_FILE || '/root/serverpanel/backend/logs/auth.log';

function isPrivate(ip) {
  if (!ip) return true;
  const v = ip.replace(/^::ffff:/, '');
  return (
    v === '127.0.0.1' ||
    v === '::1' ||
    v.startsWith('10.') ||
    v.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v) ||
    v.startsWith('fe80')
  );
}

// IP'nin coğrafi konumunu best-effort sorgular (ip-api.com, anahtar gerektirmez).
async function geoLookup(ip) {
  if (isPrivate(ip)) return { note: 'private/local' };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,org,query`,
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    if (!res.ok) return {};
    const d = await res.json();
    if (d.status !== 'success') return {};
    return { country: d.country, region: d.regionName, city: d.city, isp: d.isp, org: d.org };
  } catch {
    return {}; // konum alınamadı — log yine de yazılır
  }
}

// Bir giriş olayını detaylı loglar. Login akışını yavaşlatmamak için
// fire-and-forget çağrılır; hatalar yutulur (best-effort).
export async function logAuthEvent({ result, username, ip, userAgent }) {
  const now = new Date();
  const geo = await geoLookup(ip);
  const entry = {
    result, // 'success' | 'fail' | 'locked'
    timestamp: now.toISOString(),
    localTime: now.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
    ip: ip || 'unknown',
    username,
    location: geo,
    userAgent: userAgent || 'unknown',
  };
  try {
    await mkdir(dirname(LOG_FILE), { recursive: true });
    await appendFile(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch {
    // dosya yazılamazsa login'i bozma
  }
}

// Loglanmış giriş denemelerini en yeniden eskiye döndürür.
export async function readAuthEvents(limit = 200) {
  let raw;
  try {
    raw = await readFile(LOG_FILE, 'utf8');
  } catch {
    return []; // henüz log yok
  }
  const lines = raw.split('\n').filter(Boolean);
  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // bozuk satırı atla
    }
  }
  events.reverse(); // en yeni en üstte
  return events.slice(0, limit);
}
