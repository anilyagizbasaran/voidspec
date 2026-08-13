import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';
import { resolveSafePath, assertMutable, assertInside, PathError } from '../lib/paths.js';

function sendPathError(reply, err) {
  return reply.code(err?.statusCode || 400).send({ error: err?.message || 'Invalid path' });
}

// `du -sb` yardımcısı: timeout'ta süreci gerçekten öldürür ve yanlış "0"
// sonucu döndürmek yerine null döner.
function duSize(target, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const proc = spawn('du', ['-sb', '--', target]);
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

// smart-overview tüm diski tarıyor (dakikalar sürebilir). Sonucu cache'liyoruz;
// ?refresh=1 ile zorla yenilenebilir.
const OVERVIEW_TTL_MS = 10 * 60 * 1000;
let overviewCache = { at: 0, data: null, inFlight: null };

export async function fileRoutes(fastify) {
  // List directory
  fastify.get('/api/files', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let dirPath;
    try { dirPath = resolveSafePath(req.query.path || '/'); }
    catch (err) { return sendPathError(reply, err); }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async entry => {
          const fullPath = path.join(dirPath, entry.name);
          try {
            const stat = await fs.lstat(fullPath);
            return {
              name: entry.name,
              path: fullPath,
              type: entry.isDirectory() ? 'dir' : 'file',
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

      reply.send({ path: dirPath, items });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // File content
  fastify.get('/api/files/content', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let filePath;
    try { filePath = resolveSafePath(req.query.path); }
    catch (err) { return sendPathError(reply, err); }

    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) return reply.code(400).send({ error: 'Not a regular file' });
      if (stat.size > 5 * 1024 * 1024) {
        return reply.code(400).send({ error: 'File too large (max 5MB)' });
      }
      const content = await fs.readFile(filePath, 'utf8');
      reply.send({ path: filePath, content });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Download file
  fastify.get('/api/files/download', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let filePath;
    try { filePath = resolveSafePath(req.query.path); }
    catch (err) { return sendPathError(reply, err); }

    try {
      await fs.access(filePath);
      // Dosya adındaki tırnak/CR-LF header'ı bozabilir; temizliyoruz.
      const filename = path.basename(filePath).replace(/["\r\n]/g, '_');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.send(createReadStream(filePath));
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Download as tar.gz (file or directory)
  fastify.get('/api/files/download-tar', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let targetPath;
    try { targetPath = resolveSafePath(req.query.path); }
    catch (err) { return sendPathError(reply, err); }

    try {
      await fs.access(targetPath);
      const name = path.basename(targetPath).replace(/["\r\n]/g, '_') || 'archive';
      const parentDir = path.dirname(targetPath);
      const baseName = path.basename(targetPath);

      reply.header('Content-Disposition', `attachment; filename="${name}.tar.gz"`);
      reply.header('Content-Type', 'application/gzip');

      const tar = spawn('tar', ['-czf', '-', '-C', parentDir, '--', baseName]);
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
      try { targetDir = assertMutable(resolveSafePath(req.query.path)); }
      catch (err) { return sendPathError(reply, err); }
    }

    const uploaded = [];

    try {
      for await (const part of req.parts()) {
        if (part.type === 'field' && part.fieldname === 'path') {
          if (!targetDir) targetDir = assertMutable(resolveSafePath(part.value));
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
          await pipeline(part.file, createWriteStream(destPath));
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
                    await fs.access(p);
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
            const df = spawn('df', ['-B1', '/']);
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
      from = resolveSafePath(req.body?.from);
      to = assertMutable(resolveSafePath(req.body?.to));
    } catch (err) { return sendPathError(reply, err); }

    try {
      await fs.cp(from, to, { recursive: true });
      reply.send({ ok: true });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Rename / move
  fastify.post('/api/files/rename', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let from, to;
    try {
      from = assertMutable(resolveSafePath(req.body?.from));
      to = assertMutable(resolveSafePath(req.body?.to));
    } catch (err) { return sendPathError(reply, err); }

    try {
      await fs.rename(from, to);
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
      const safeDest = assertMutable(resolveSafePath(destDir));
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
            const writer = createWriteStream(destPath);
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
    try { filePath = assertMutable(resolveSafePath(req.query.path)); }
    catch (err) { return sendPathError(reply, err); }

    try {
      await fs.rm(filePath, { recursive: true });
      reply.send({ ok: true });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Directory size (du -sb)
  fastify.get('/api/files/du', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    let targetPath;
    try { targetPath = resolveSafePath(req.query.path); }
    catch (err) { return sendPathError(reply, err); }

    try {
      await fs.access(targetPath);
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
    try { dirPath = resolveSafePath(req.body?.path); }
    catch (err) { return sendPathError(reply, err); }

    try {
      await fs.mkdir(dirPath, { recursive: true });
      reply.send({ ok: true });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });
}
