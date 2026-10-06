import fs from 'fs';
import path from 'path';

// Backend konteyner içinde çalışıyor. Kendi kök dizini node imajının kökü —
// yani `/etc`, `/usr`, `/var/www` gibi yollar okunduğunda sunucunun değil
// imajın içeriği görünüyordu (`/var/www` "No such file or directory",
// `/etc` altında ImageMagick-6 ...). Host'un kökü konteynere HOST_FS_ROOT
// altına bağlanıyor ve dosya işlemleri oraya çevriliyor.
//
// API dışarıya HER ZAMAN mantıksal (host'taki gerçek) yolu döner; çeviri
// yalnızca fs çağrılarının hemen öncesinde yapılır. Böylece istemci tarafı ve
// PROTECTED yol kontrolleri host yollarıyla çalışmaya devam eder.
const configured = process.env.HOST_FS_ROOT || '';

function detectRoot() {
  if (!configured) return '';
  const normalized = path.normalize(configured).replace(/\/+$/, '');
  if (!normalized || normalized === '/') return '';
  try {
    // Mount yoksa (yerel geliştirme) çeviri yapmadan devam et — aksi halde
    // her yol var olmayan bir dizine düşerdi.
    if (!fs.statSync(normalized).isDirectory()) return '';
  } catch {
    return '';
  }
  return normalized;
}

export const HOST_ROOT = detectRoot();
export const hostFsEnabled = HOST_ROOT !== '';

// Mantıksal host yolu → konteyner içinden erişilebilir yol.
export function toFs(logicalPath) {
  if (!HOST_ROOT) return logicalPath;
  if (logicalPath === '/') return HOST_ROOT;
  return HOST_ROOT + logicalPath;
}

// Konteyner yolu → mantıksal host yolu (fs'ten dönen yolları geri çevirmek için).
export function toLogical(fsPath) {
  if (!HOST_ROOT) return fsPath;
  if (fsPath === HOST_ROOT) return '/';
  return fsPath.startsWith(HOST_ROOT + '/') ? fsPath.slice(HOST_ROOT.length) : fsPath;
}

// Host'taki mutlak symlink'ler (`/etc/nginx/sites-enabled/x -> /etc/nginx/...`)
// konteyner içinden takip edilince HOST_ROOT'un dışına, yani imajın kendi
// dosya sistemine çözülüyordu: dosya "yok" görünüyor ya da imajdaki başka bir
// dosya (/etc/localtime) okunuyordu; kaydetmek ise symlink'i düz dosyayla
// eziyordu. Yolu parça parça gezip her symlink'i host kökü içinde çözüyoruz.
//
// followLast=false: son bileşen symlink ise kendisi döner (sil/taşı
// işlemleri hedefi değil bağlantının kendisini etkilemeli).
// Var olmayan bir bileşene gelince kalan kısım olduğu gibi eklenir (yeni
// dosya/dizin oluşturma).
const MAX_LINK_HOPS = 40;

export async function resolveHostPath(logicalPath, { followLast = true } = {}) {
  if (!HOST_ROOT) return logicalPath;
  const parts = logicalPath.split('/').filter(Boolean);
  let resolved = '/';
  let hops = 0;
  while (parts.length) {
    const name = parts.shift();
    if (name === '.') continue;
    if (name === '..') { resolved = path.posix.dirname(resolved); continue; }
    const next = path.posix.join(resolved, name);
    if (!followLast && parts.length === 0) return next;

    let st;
    try {
      st = await fs.promises.lstat(toFs(next));
    } catch {
      return path.posix.join(next, ...parts);
    }
    if (!st.isSymbolicLink()) { resolved = next; continue; }

    if (++hops > MAX_LINK_HOPS) {
      const err = new Error('Too many levels of symbolic links');
      err.statusCode = 400;
      throw err;
    }
    const target = await fs.promises.readlink(toFs(next));
    if (target.startsWith('/')) resolved = '/';
    parts.unshift(...target.split('/').filter(Boolean));
  }
  return resolved;
}
