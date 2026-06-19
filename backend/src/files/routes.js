import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';

function safePath(requestedPath) {
  const normalized = path.normalize(requestedPath || '/');
  if (!path.isAbsolute(normalized)) return '/';
  return normalized;
}

export async function fileRoutes(fastify) {
  // List directory
  fastify.get('/api/files', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const dirPath = safePath(req.query.path || '/');

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async entry => {
          try {
            const fullPath = path.join(dirPath, entry.name);
            const stat = await fs.stat(fullPath);
            return {
              name: entry.name,
              path: fullPath,
              type: entry.isDirectory() ? 'dir' : 'file',
              size: stat.size,
              modified: stat.mtime,
              permissions: stat.mode.toString(8),
            };
          } catch {
            return {
              name: entry.name,
              path: path.join(dirPath, entry.name),
              type: entry.isDirectory() ? 'dir' : 'file',
              size: 0,
              modified: null,
              permissions: '000',
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
    const filePath = safePath(req.query.path || '');
    if (!filePath) return reply.code(400).send({ error: 'Path required' });

    try {
      const stat = await fs.stat(filePath);
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
    const filePath = safePath(req.query.path || '');
    if (!filePath) return reply.code(400).send({ error: 'Path required' });

    try {
      await fs.access(filePath);
      const filename = path.basename(filePath);
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.send(createReadStream(filePath));
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Download as tar.gz (file or directory)
  fastify.get('/api/files/download-tar', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const targetPath = safePath(req.query.path || '');
    if (!targetPath) return reply.code(400).send({ error: 'Path required' });

    try {
      await fs.access(targetPath);
      const name = path.basename(targetPath) || 'archive';
      const parentDir = path.dirname(targetPath);
      const baseName = path.basename(targetPath);

      reply.header('Content-Disposition', `attachment; filename="${name}.tar.gz"`);
      reply.header('Content-Type', 'application/gzip');

      const tar = spawn('tar', ['-czf', '-', '-C', parentDir, baseName]);
      tar.stderr.on('data', () => {});
      reply.send(tar.stdout);
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Upload file(s) - supports multiple files
  fastify.post('/api/files/upload', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const parts = req.parts();
    let targetDir = '/tmp';
    const uploaded = [];

    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'path') {
        targetDir = safePath(part.value);
      } else if (part.type === 'file') {
        const destPath = path.join(targetDir, part.filename);
        await pipeline(part.file, createWriteStream(destPath));
        uploaded.push(part.filename);
      }
    }

    reply.send({ ok: true, uploaded });
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

    async function duSize(p) {
      return new Promise((resolve) => {
        const proc = spawn('du', ['-sb', '--', p]);
        let out = '';
        proc.stdout.on('data', d => { out += d; });
        proc.on('close', () => resolve(parseInt(out.split('\t')[0], 10) || 0));
        proc.on('error', () => resolve(0));
        setTimeout(() => { try { proc.kill(); } catch {} resolve(0); }, 12000);
      });
    }

    const [categories, disk] = await Promise.all([
      Promise.all(
        CATEGORIES.map(async (cat) => {
          const parts = await Promise.all(
            cat.paths.map(async (p) => {
              try { await fs.access(p); return { path: p, size: await duSize(p) }; }
              catch { return null; }
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

    reply.send({ categories: categories.filter(Boolean), disk });
  });

  // Copy
  fastify.post('/api/files/copy', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const from = safePath(req.body.from || '');
    const to = safePath(req.body.to || '');
    if (!from || !to) return reply.code(400).send({ error: 'from and to required' });
    try {
      await fs.cp(from, to, { recursive: true });
      reply.send({ ok: true });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Rename / move
  fastify.post('/api/files/rename', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const from = safePath(req.body.from || '');
    const to = safePath(req.body.to || '');
    if (!from || !to) return reply.code(400).send({ error: 'from and to required' });

    try {
      await fs.rename(from, to);
      reply.send({ ok: true });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Fetch URL to server
  fastify.post('/api/files/fetch-url', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { url, destDir, filename } = req.body;
    if (!url || !destDir) return reply.code(400).send({ error: 'url and destDir required' });

    const safeDest = safePath(destDir);
    const finalName = filename || decodeURIComponent(url.split('/').pop().split('?')[0]) || 'download';
    const destPath = path.join(safeDest, finalName);

    try {
      await new Promise((resolve, reject) => {
        const getFunc = url.startsWith('https') ? httpsGet : httpGet;
        const doRequest = (targetUrl) => {
          getFunc(targetUrl, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              doRequest(res.headers.location);
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}`));
              return;
            }
            const writer = createWriteStream(destPath);
            res.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
          }).on('error', reject);
        };
        doRequest(url);
      });

      reply.send({ ok: true, path: destPath, filename: finalName });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Delete
  fastify.delete('/api/files', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const filePath = safePath(req.query.path || '');
    if (!filePath) return reply.code(400).send({ error: 'Path required' });

    try {
      await fs.rm(filePath, { recursive: true });
      reply.send({ ok: true });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Directory size (du -sh)
  fastify.get('/api/files/du', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const targetPath = safePath(req.query.path || '');
    if (!targetPath) return reply.code(400).send({ error: 'Path required' });

    try {
      await fs.access(targetPath);
      const result = await new Promise((resolve, reject) => {
        const du = spawn('du', ['-sb', '--', targetPath]);
        let out = '';
        du.stdout.on('data', d => { out += d; });
        du.on('close', () => resolve(parseInt(out.split('\t')[0].trim(), 10) || 0));
        du.on('error', reject);
      });
      reply.send({ path: targetPath, size: result });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });

  // Mkdir
  fastify.post('/api/files/mkdir', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const dirPath = safePath(req.body.path || '');
    if (!dirPath) return reply.code(400).send({ error: 'Path required' });

    try {
      await fs.mkdir(dirPath, { recursive: true });
      reply.send({ ok: true });
    } catch (err) {
      reply.code(400).send({ error: err.message });
    }
  });
}
