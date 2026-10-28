import path from 'path';

// Silinmesi/taşınması sistemi bozacak dizinler. Tam eşleşme aranır: `/root`
// silinemez ama `/root/foo` silinebilir.
const PROTECTED = new Set([
  '/', '/bin', '/boot', '/dev', '/etc', '/home', '/lib', '/lib32', '/lib64',
  '/libx32', '/media', '/mnt', '/opt', '/proc', '/root', '/run', '/sbin',
  '/srv', '/sys', '/tmp', '/usr', '/var',
  '/var/lib', '/var/lib/docker', '/var/log', '/var/run', '/usr/bin', '/usr/lib',
  '/usr/local', '/usr/sbin', '/etc/passwd', '/etc/shadow', '/etc/sudoers',
]);

export class PathError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

// Kullanıcıdan gelen yolu mutlak, normalize edilmiş bir yola çevirir.
// Eski safePath() boş girdide sessizce '/' dönüyordu; artık hata fırlatır.
export function resolveSafePath(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new PathError('Path required');
  }
  if (input.includes('\0')) {
    throw new PathError('Invalid path');
  }
  const normalized = path.normalize(input.trim());
  if (!path.isAbsolute(normalized)) {
    throw new PathError('Path must be absolute');
  }
  // Sondaki slash'ı at ('/var/log/' → '/var/log') ki PROTECTED eşleşmesi kaçmasın.
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : '/';
}

// Yıkıcı işlemler (sil, taşı, üzerine yaz) için ek kontrol.
export function assertMutable(p) {
  if (PROTECTED.has(p)) {
    throw new PathError(`"${p}" is a protected system path — operation blocked`);
  }
  return p;
}

// Bir yolun verilen dizinin altında kaldığını doğrular (upload traversal'ı için).
export function assertInside(parentDir, target) {
  const parent = path.resolve(parentDir);
  const child = path.resolve(target);
  if (child !== parent && !child.startsWith(parent + path.sep)) {
    throw new PathError('Path escapes target directory');
  }
  return child;
}

export const PROTECTED_PATHS = PROTECTED;
