import { execFile, spawn } from 'child_process';
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

// NOT: Bilerek senkron (execFileSync) bir varyant sunulmuyor. Her nsenter
// çağrısı 50-350 ms sürüyor; senkron çalıştırıldığında bu süre boyunca tüm
// event loop bloke oluyordu — açık terminaller donuyor, diğer istekler
// sıraya giriyor, healthcheck zaman aşımına düşebiliyordu.

// stdin üzerinden veri gönderir (chpasswd, crontab -, tee ...).
// Senkron sürüm event loop'u bloke ettiği için yalnızca async kullanılmalı;
// hata durumunda stderr ile birlikte fırlatır.
export function hostInput(argv, input, opts = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = 10000, env = DEFAULT_ENV } = baseOpts(opts);
    const child = spawn(NSENTER, [...NS_ARGS, ...argv], { env });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch { /* zaten bitmiş */ }
      reject(new Error(`${argv[0]} timed out after ${timeout}ms`));
    }, timeout);

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', err => finish(reject, err));
    child.on('close', code => {
      if (code === 0) return finish(resolve, stdout.trim());
      const err = new Error(stderr.trim() || `${argv[0]} exited with code ${code}`);
      err.stderr = stderr.trim();
      err.code = code;
      finish(reject, err);
    });

    // stdin kapanmadan komut (chpasswd, tee) beklemeye devam eder.
    child.stdin.on('error', () => { /* süreç erken kapandıysa yoksay */ });
    child.stdin.end(input);
  });
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
