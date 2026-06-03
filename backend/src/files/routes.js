import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';

function safePath(requestedPath) {
  const normalized = path.normalize(requestedPath);
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
