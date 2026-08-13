import { appendFile, mkdir, open, rename, stat } from 'fs/promises';
import { dirname } from 'path';

// Giriş denemeleri kalıcı dosyaya yazılır. /root container'a mount edildiği
// için host'tan da okunabilir: /root/serverpanel/backend/logs/auth.log
const LOG_FILE = process.env.AUTH_LOG_FILE || '/root/serverpanel/backend/logs/auth.log';
const MAX_LOG_BYTES = 5 * 1024 * 1024;  // bu boyutu aşınca döndür
const MAX_ROTATIONS = 3;                // auth.log.1 … auth.log.3
const TAIL_BYTES = 1024 * 1024;         // okurken dosyanın sadece son 1 MB'ı

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

// Aynı IP için tekrar tekrar dış servise gitmeyelim.
const geoCache = new Map();
const GEO_TTL_MS = 24 * 60 * 60 * 1000;
const GEO_CACHE_MAX = 500;

// IP'nin coğrafi konumunu best-effort sorgular (ip-api.com, anahtar gerektirmez).
async function geoLookup(ip) {
  if (isPrivate(ip)) return { note: 'private/local' };

  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_TTL_MS) return cached.value;

  let value = {};
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp,org,query`,
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    if (res.ok) {
      const d = await res.json();
      if (d.status === 'success') {
        value = { country: d.country, region: d.regionName, city: d.city, isp: d.isp, org: d.org };
      }
    }
  } catch {
    value = {}; // konum alınamadı — log yine de yazılır
  }

  if (geoCache.size >= GEO_CACHE_MAX) geoCache.clear();
  geoCache.set(ip, { at: Date.now(), value });
  return value;
}

// Dosya büyüdüyse auth.log → auth.log.1 → … şeklinde döndür.
async function rotateIfNeeded() {
  try {
    const { size } = await stat(LOG_FILE);
    if (size < MAX_LOG_BYTES) return;
    for (let i = MAX_ROTATIONS - 1; i >= 1; i--) {
      await rename(`${LOG_FILE}.${i}`, `${LOG_FILE}.${i + 1}`).catch(() => {});
    }
    await rename(LOG_FILE, `${LOG_FILE}.1`).catch(() => {});
  } catch {
    // dosya yok — döndürecek bir şey de yok
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
    await rotateIfNeeded();
    await appendFile(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch {
    // dosya yazılamazsa login'i bozma
  }
}

// Dosyanın sadece son TAIL_BYTES kadarını okur; tamamını belleğe almaz.
async function readTail(file) {
  let fh;
  try {
    fh = await open(file, 'r');
    const { size } = await fh.stat();
    const start = Math.max(0, size - TAIL_BYTES);
    const length = size - start;
    if (length === 0) return '';
    const buf = Buffer.alloc(length);
    await fh.read(buf, 0, length, start);
    let text = buf.toString('utf8');
    // Baştan kesilmiş yarım satırı at.
    if (start > 0) text = text.slice(text.indexOf('\n') + 1);
    return text;
  } catch {
    return '';
  } finally {
    await fh?.close().catch(() => {});
  }
}

function parseLines(raw, out) {
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // bozuk satırı atla
    }
  }
  return out;
}

// Loglanmış giriş denemelerini en yeniden eskiye döndürür.
export async function readAuthEvents(limit = 200) {
  const events = parseLines(await readTail(LOG_FILE), []);

  // Yeni döndürülmüşse mevcut dosya neredeyse boş olabilir; bir önceki
  // dosyadan tamamla.
  if (events.length < limit) {
    const older = parseLines(await readTail(`${LOG_FILE}.1`), []);
    events.unshift(...older);
  }

  events.reverse(); // en yeni en üstte
  return events.slice(0, limit);
}
