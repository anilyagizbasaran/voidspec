import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';
import { resolveSafePath, assertMutable, assertInside, PathError } from '../lib/paths.js';
import { toFs, hostFsEnabled, resolveHostPath } from '../lib/hostfs.js';

function sendPathError(reply, err) {
  return reply.code(err?.statusCode || 400).send({ error: err?.message || 'Invalid path' });
}

// Kullanıcı yolunu doğrular ve host'taki symlink'leri host kökü içinde çözer
// (bkz. resolveHostPath). mutable: yıkıcı işlem — hem verilen yol hem de
// symlink'in işaret ettiği gerçek yol korumalı listeye karşı denetlenir.
async function hostPath(input, { followLast = true, mutable = false } = {}) {
  const logical = resolveSafePath(input);
  if (mutable) assertMutable(logical);
  const real = await resolveHostPath(logical, { followLast });
  if (mutable) assertMutable(real);
  return real;
}

// `du -sb` yardımcısı: timeout'ta süreci gerçekten öldürür ve yanlış "0"
// sonucu döndürmek yerine null döner.
function duSize(target, timeoutMs = 15000) {
  return new Promise((resolve) => {
    // -x: başka dosya sistemlerine inme. Host kökü /host'a bağlı olduğundan
    // aksi halde /proc, /sys ve Docker'ın overlay bağlamaları (aynı veriyi
    // ikinci kez) taranıyordu.
    const proc = spawn('du', ['-sbx', '--', toFs(target)]);
    let out = '';
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* zaten bitmiş */ }
      finish(null);
    }, timeoutMs);

    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', () => {});
    proc.on('close', () => finish(parseInt(out.split('\t')[0], 10) || 0));
    proc.on('error', () => finish(null));
  });
}

// Çekirdeğin sanal dosya sistemleri: boyutları anlamsız, taramaları pahalı.
const VIRTUAL_FS = ['/proc', '/sys', '/dev'];
export function isVirtualFsPath(p) {
  return VIRTUAL_FS.some(v => p === v || p.startsWith(v + '/'));
}

// smart-overview tüm diski tarıyor (dakikalar sürebilir). Sonucu cache'liyoruz;
// ?refresh=1 ile zorla yenilenebilir.
const OVERVIEW_TTL_MS = 10 * 60 * 1000;
let overviewCache = { at: 0, data: null, inFlight: null };

export async function fileRoutes(fastify) {
  // List directory
  fastify.get('/api/files', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    // Gösterilen yol kullanıcının girdiği (mantıksal) yol kalır; okunan dizin
    // symlink'leri çözülmüş gerçek yol.
    let dirPath, realDir;
    try {
      dirPath = resolveSafePath(req.query.path || '/');
      realDir = await resolveHostPath(dirPath);
    } catch (err) { return sendPathError(reply, err); }

    try {
      const entries = await fs.readdir(toFs(realDir), { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async entry => {
          const fullPath = path.join(dirPath, entry.name);
          try {
            const stat = await fs.lstat(toFs(path.join(realDir, entry.name)));
            // Dizine işaret eden symlink'ler (sites-enabled, /bin → usr/bin)
            // açılabilir olsun diye hedefin türüne bakıyoruz.
            let isDir = entry.isDirectory();
            if (stat.isSymbolicLink()) {
              const target = await resolveHostPath(path.join(realDir, entry.name)).catch(() => null);
              isDir = target ? (await fs.stat(toFs(target)).catch(() => null))?.isDirectory() ?? false : false;
            }
            return {
              name: entry.name,
              path: fullPath,
              type: isDir ? 'dir' : 'file',
              size: stat.size,
              modified: stat.mtime,
              permissions: stat.mode.toString(8),
              symlink: stat.isSymbolicLink(),
            };
          } catch {
            return {
              name: entry.name,
              path: fullPath,
              type: entry.isDirectory() ? 'dir' : 'file',
              size: 0,
              modified: null,
              permissions: '000',
              symlink: false,
            };
          }
        })
      );

      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      // hostFs=false ise konteynerin kendi kökü listeleniyor demektir; istemci
      // bunu kullanıcıya bildirebilsin.
      reply.send({ path: dirPath, items, hostFs: hostFsEnabled });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // File content
  fastify.get('/api/files/content', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let filePath, realPath;
    try {
      filePath = resolveSafePath(req.query.path);
      realPath = await resolveHostPath(filePath);
    } catch (err) { return sendPathError(reply, err); }

    try {
      const stat = await fs.stat(toFs(realPath));
      if (!stat.isFile()) return reply.code(400).send({ error: 'Not a regular file' });
      if (stat.size > 5 * 1024 * 1024) {
        return reply.code(400).send({ error: 'File too large (max 5MB)' });
      }
      const content = await fs.readFile(toFs(realPath), 'utf8');
      reply.send({ path: filePath, realPath, content });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Save file content. Panel dosyayı açıp gösterebiliyor ama kaydedemiyordu —
  // sunucu paneli için yapılandırma dosyasını düzenleyebilmek temel işlev.
  fastify.post('/api/files/content', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { path: rawPath, content, backup = true } = req.body || {};
    if (typeof content !== 'string') {
      return reply.code(400).send({ error: 'content must be a string' });
    }
    if (Buffer.byteLength(content, 'utf8') > 5 * 1024 * 1024) {
      return reply.code(413).send({ error: 'Content too large (max 5MB)' });
    }

    // Symlink'in hedefine yazıyoruz: rename ile bağlantının kendisini ezmek
    // (sites-enabled/x) gerçek yapılandırmayı değiştirmeden bağlantıyı
    // koparıyordu.
    let filePath;
    try { filePath = await hostPath(rawPath, { mutable: true }); }
    catch (err) { return sendPathError(reply, err); }

    const fsPath = toFs(filePath);

    try {
      // Var olan dosyanın türünü koru: dizinin veya cihaz dosyasının üzerine
      // yazmaya çalışmak sessiz bir felaket olurdu.
      let existed = true;
      try {
        const stat = await fs.stat(fsPath);
        if (!stat.isFile()) {
          return reply.code(400).send({ error: 'Not a regular file' });
        }
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        existed = false;
      }

      let backupPath = null;
      if (existed && backup) {
        backupPath = `${filePath}.bak`;
        await fs.copyFile(fsPath, toFs(backupPath));
      }

      // Aynı dizine geçici dosya yazıp rename ile yer değiştiriyoruz: yazma
      // yarıda kalırsa hedef dosya bozulmuş halde kalmıyor.
      const tmpPath = `${fsPath}.serverpanel-tmp-${process.pid}`;
      try {
        await fs.writeFile(tmpPath, content, 'utf8');
        if (existed) {
          // Sahiplik/izinleri koru — rename bunları taşımaz.
          const { mode, uid, gid } = await fs.stat(fsPath);
          await fs.chmod(tmpPath, mode);
          await fs.chown(tmpPath, uid, gid).catch(() => { /* izin yoksa geç */ });
        }
        await fs.rename(tmpPath, fsPath);
      } catch (err) {
        await fs.rm(tmpPath, { force: true }).catch(() => {});
        throw err;
      }

      fastify.log.info({ path: filePath, created: !existed }, 'File saved');
      reply.send({ ok: true, path: filePath, created: !existed, backupPath });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Download file
  fastify.get('/api/files/download', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let filePath;
    try { filePath = await hostPath(req.query.path); }
    catch (err) { return sendPathError(reply, err); }

    try {
      const stat = await fs.stat(toFs(filePath));
      if (!stat.isFile()) return reply.code(400).send({ error: 'Not a regular file' });
      // Dosya adındaki tırnak/CR-LF header'ı bozabilir; temizliyoruz.
      const filename = path.basename(filePath).replace(/["\r\n]/g, '_');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.send(createReadStream(toFs(filePath)));
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Download as tar.gz (file or directory)
  fastify.get('/api/files/download-tar', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let targetPath;
    try { targetPath = await hostPath(req.query.path); }
    catch (err) { return sendPathError(reply, err); }

    try {
      await fs.access(toFs(targetPath));
      const name = path.basename(targetPath).replace(/["\r\n]/g, '_') || 'archive';
      const parentDir = path.dirname(targetPath);
      const baseName = path.basename(targetPath);

      reply.header('Content-Disposition', `attachment; filename="${name}.tar.gz"`);
      reply.header('Content-Type', 'application/gzip');

      const tar = spawn('tar', ['-czf', '-', '-C', toFs(parentDir), '--', baseName]);
      tar.stderr.on('data', () => {});
      reply.raw.on('close', () => { try { tar.kill(); } catch { /* bitmiş */ } });
      reply.send(tar.stdout);
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Upload file(s) - supports multiple files
  fastify.post('/api/files/upload', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    // Hedef dizin öncelikle query string'den okunur; böylece multipart alan
    // sırasına bağımlılık ortadan kalkar (eskiden 'path' alanı dosyadan sonra
    // gelirse dosyalar sessizce /tmp'ye düşüyordu).
    let targetDir = null;
    if (req.query.path) {
      try { targetDir = await hostPath(req.query.path, { mutable: true }); }
      catch (err) { return sendPathError(reply, err); }
    }

    const uploaded = [];

    try {
      for await (const part of req.parts()) {
        if (part.type === 'field' && part.fieldname === 'path') {
          if (!targetDir) targetDir = await hostPath(part.value, { mutable: true });
        } else if (part.type === 'file') {
          if (!targetDir) {
            // Dosyayı tüketmezsek istek asılı kalır.
            part.file.resume();
            throw new PathError('Upload target path missing (send ?path= or the path field first)');
          }
          // filename istemci kontrolünde: '../' ile hedef dizinin dışına
          // yazılmasını engelliyoruz.
          const safeName = path.basename(part.filename || '').replace(/^\.+/, '') || 'upload';
          const destPath = assertInside(targetDir, path.join(targetDir, safeName));
          await pipeline(part.file, createWriteStream(toFs(destPath)));
          uploaded.push(safeName);
        }
      }
    } catch (err) {
      return sendPathError(reply, err);
    }

    reply.send({ ok: true, uploaded, path: targetDir });
  });

  // Smart disk overview — groups paths into meaningful categories
  fastify.get('/api/files/smart-overview', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const CATEGORIES = [
      { id: 'system',   label: 'Sistem',            paths: ['/usr', '/lib', '/lib64', '/lib32', '/bin', '/sbin', '/boot'] },
      { id: 'apps',     label: 'Uygulamalar',        paths: ['/opt', '/snap', '/var/cache/apt', '/var/lib/dpkg', '/var/lib/apt'] },
      { id: 'docker',   label: 'Docker',             paths: ['/var/lib/docker'] },
      { id: 'userdata', label: 'Kullanıcı Verileri', paths: ['/home', '/root'] },
      { id: 'web',      label: 'Web & Servisler',    paths: ['/var/www', '/srv'] },
      { id: 'logs',     label: 'Loglar',             paths: ['/var/log'] },
      { id: 'config',   label: 'Yapılandırma',       paths: ['/etc'] },
      { id: 'temp',     label: 'Geçici Dosyalar',    paths: ['/tmp', '/var/tmp'] },
    ];

    const fresh = req.query.refresh === '1';
    const age = Date.now() - overviewCache.at;
    if (!fresh && overviewCache.data && age < OVERVIEW_TTL_MS) {
      return reply.send({ ...overviewCache.data, cachedAt: overviewCache.at });
    }

    // Aynı anda gelen istekler tek bir taramayı paylaşsın.
    if (!overviewCache.inFlight) {
      overviewCache.inFlight = (async () => {
        const [categories, disk] = await Promise.all([
          Promise.all(
            CATEGORIES.map(async (cat) => {
              const parts = await Promise.all(
                cat.paths.map(async (p) => {
                  try {
                    await fs.access(toFs(p));
                    const size = await duSize(p);
                    return size === null ? null : { path: p, size };
                  } catch { return null; }
                })
              );
              const existing = parts.filter(Boolean);
              const size = existing.reduce((s, e) => s + e.size, 0);
              if (size === 0) return null;
              return { ...cat, size, primaryPath: existing[0].path, paths: existing.map(e => e.path) };
            })
          ),
          new Promise((resolve) => {
            const df = spawn('df', ['-B1', toFs('/')]);
            let out = '';
            df.stdout.on('data', d => { out += d; });
            df.on('close', () => {
              const parts = (out.trim().split('\n')[1] ?? '').split(/\s+/);
              const total = parseInt(parts[1], 10);
              const used  = parseInt(parts[2], 10);
              const avail = parseInt(parts[3], 10);
              resolve(total ? { total, used, avail } : null);
            });
            df.on('error', () => resolve(null));
          }),
        ]);
        return { categories: categories.filter(Boolean), disk };
      })().finally(() => { overviewCache.inFlight = null; });
    }

    try {
      const data = await overviewCache.inFlight;
      overviewCache = { at: Date.now(), data, inFlight: overviewCache.inFlight };
      reply.send({ ...data, cachedAt: overviewCache.at });
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // Copy
  fastify.post('/api/files/copy', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let from, to;
    try {
      from = await hostPath(req.body?.from);
      to = await hostPath(req.body?.to, { followLast: false, mutable: true });
    } catch (err) { return sendPathError(reply, err); }

    try {
      await fs.cp(toFs(from), toFs(to), { recursive: true });
      reply.send({ ok: true });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Rename / move
  fastify.post('/api/files/rename', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let from, to;
    try {
      from = await hostPath(req.body?.from, { followLast: false, mutable: true });
      to = await hostPath(req.body?.to, { followLast: false, mutable: true });
    } catch (err) { return sendPathError(reply, err); }

    try {
      await fs.rename(toFs(from), toFs(to));
      reply.send({ ok: true });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Fetch URL to server
  fastify.post('/api/files/fetch-url', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { url, destDir, filename } = req.body || {};
    if (!url || !destDir) return reply.code(400).send({ error: 'url and destDir required' });

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return reply.code(400).send({ error: 'Invalid URL' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return reply.code(400).send({ error: 'Only http/https URLs are supported' });
    }

    let destPath;
    try {
      const safeDest = await hostPath(destDir, { mutable: true });
      const rawName = filename || decodeURIComponent(parsed.pathname.split('/').pop() || '') || 'download';
      const safeName = path.basename(rawName).replace(/^\.+/, '') || 'download';
      destPath = assertInside(safeDest, path.join(safeDest, safeName));
    } catch (err) { return sendPathError(reply, err); }

    try {
      await new Promise((resolve, reject) => {
        let redirects = 0;
        const doRequest = (targetUrl) => {
          const getFunc = targetUrl.startsWith('https:') ? httpsGet : httpGet;
          getFunc(targetUrl, { timeout: 30000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              res.resume();
              if (++redirects > 5) return reject(new Error('Too many redirects'));
              return doRequest(new URL(res.headers.location, targetUrl).toString());
            }
            if (res.statusCode !== 200) {
              res.resume();
              return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const writer = createWriteStream(toFs(destPath));
            res.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
          }).on('timeout', function () { this.destroy(new Error('Request timeout')); })
            .on('error', reject);
        };
        doRequest(parsed.toString());
      });

      reply.send({ ok: true, path: destPath, filename: path.basename(destPath) });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Delete
  fastify.delete('/api/files', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    // Eskiden path parametresi boş gelirse safePath() '/' dönüyor ve tüm
    // dosya sistemi siliniyordu. Artık boş path hata, kritik yollar korumalı.
    let filePath;
    try { filePath = await hostPath(req.query.path, { followLast: false, mutable: true }); }
    catch (err) { return sendPathError(reply, err); }

    try {
      await fs.rm(toFs(filePath), { recursive: true });
      reply.send({ ok: true });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Directory size (du -sb)
  fastify.get('/api/files/du', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let targetPath;
    try { targetPath = await hostPath(req.query.path); }
    catch (err) { return sendPathError(reply, err); }

    if (isVirtualFsPath(targetPath)) {
      return reply.send({ path: targetPath, size: null, skipped: 'virtual filesystem' });
    }

    try {
      await fs.access(toFs(targetPath));
      const size = await duSize(targetPath);
      if (size === null) return reply.code(504).send({ error: 'du timed out' });
      reply.send({ path: targetPath, size });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Mkdir
  fastify.post('/api/files/mkdir', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let dirPath;
    try { dirPath = await hostPath(req.body?.path); }
    catch (err) { return sendPathError(reply, err); }

    try {
      await fs.mkdir(toFs(dirPath), { recursive: true });
      reply.send({ ok: true });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });
}
