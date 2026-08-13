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
