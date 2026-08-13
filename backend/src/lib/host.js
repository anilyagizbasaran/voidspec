import { execFile, execFileSync, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Host'un mount namespace'ine geçmek için ortak önek. Backend konteyner içinde
// çalışıyor; systemctl/ufw/apt/crontab gibi araçlar sadece host namespace'inde
// anlamlı.
const NSENTER = 'nsenter';
const NS_ARGS = ['--mount=/proc/1/ns/mnt', '--'];

const DEFAULT_ENV = {
  ...process.env,
  PATH: '/usr/sbin:/usr/bin:/sbin:/bin',
  DEBIAN_FRONTEND: 'noninteractive',
};

// journalctl --output=json gibi çıktılar 1 MB'lık varsayılan maxBuffer'ı
// rahatlıkla aşıyor; aşınca komut ENOBUFS ile patlıyordu.
const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;

function baseOpts(opts) {
  return {
    timeout: 10000,
    env: DEFAULT_ENV,
    maxBuffer: DEFAULT_MAX_BUFFER,
    ...opts,
  };
}

// TEK GİRİŞ NOKTASI: argv dizisi alır, asla shell'den geçmez. String
// interpolasyonlu `sh -c` kullanılmadığı için komut enjeksiyonu mümkün değil.
export async function host(argv, opts = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(NSENTER, [...NS_ARGS, ...argv], baseOpts(opts));
    return { stdout: stdout.toString().trim(), stderr: stderr.toString().trim(), ok: true };
  } catch (err) {
    return {
      stdout: err.stdout?.toString().trim() || '',
      stderr: err.stderr?.toString().trim() || err.message,
      ok: false,
    };
  }
}

// Komut başarısız olursa fırlatır — çağıran hatayı kullanıcıya iletmek istiyorsa.
export async function hostOrThrow(argv, opts = {}) {
  const { stdout, stderr } = await execFileAsync(NSENTER, [...NS_ARGS, ...argv], baseOpts(opts));
  return { stdout: stdout.toString().trim(), stderr: stderr.toString().trim() };
}

// Senkron varyant — hata durumunda yakalanmış stdout'u döner (eski `run()` davranışı).
export function hostSync(argv, opts = {}) {
  try {
    return execFileSync(NSENTER, [...NS_ARGS, ...argv], baseOpts(opts)).toString().trim();
  } catch (err) {
    return err.stdout?.toString().trim() || '';
  }
}

export function hostSyncOrThrow(argv, opts = {}) {
  return execFileSync(NSENTER, [...NS_ARGS, ...argv], baseOpts(opts)).toString().trim();
}

// stdin üzerinden veri gönderir (chpasswd, crontab -, tee ...).
export function hostWithInput(argv, input, opts = {}) {
  return execFileSync(NSENTER, [...NS_ARGS, ...argv], {
    ...baseOpts(opts),
    input,
  }).toString().trim();
}

// Uzun süren / akış tabanlı komutlar (journalctl -f gibi).
export function hostSpawn(argv, opts = {}) {
  return spawn(NSENTER, [...NS_ARGS, ...argv], { env: DEFAULT_ENV, ...opts });
}

// Host'un AĞ namespace'ine de girer. Konteyner kendi ağ namespace'inde
// olduğu için host'ta dinlenen portlar normalde görünmüyor.
const NS_NET_ARGS = ['--mount=/proc/1/ns/mnt', '--net=/proc/1/ns/net', '--'];

export async function hostNet(argv, opts = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(NSENTER, [...NS_NET_ARGS, ...argv], baseOpts(opts));
    return { stdout: stdout.toString().trim(), stderr: stderr.toString().trim(), ok: true };
  } catch (err) {
    return {
      stdout: err.stdout?.toString().trim() || '',
      stderr: err.stderr?.toString().trim() || err.message,
      ok: false,
    };
  }
}
