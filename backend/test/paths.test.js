import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSafePath, assertMutable, assertInside, PathError } from '../src/lib/paths.js';

test('resolveSafePath boş girdiyi reddeder', () => {
  // Regresyon: eskiden boş path normalize edilip "/" dönüyordu ve
  // DELETE /api/files (path'siz) tüm dosya sistemini siliyordu.
  for (const bad of ['', '   ', undefined, null, 0]) {
    assert.throws(() => resolveSafePath(bad), PathError);
  }
});

test('resolveSafePath göreli yolu reddeder', () => {
  assert.throws(() => resolveSafePath('etc/passwd'), PathError);
  assert.throws(() => resolveSafePath('../../etc'), PathError);
});

test('resolveSafePath NUL bayt içeren yolu reddeder', () => {
  assert.throws(() => resolveSafePath('/tmp/a\0b'), PathError);
});

test('resolveSafePath normalize eder ve sondaki slash\'ı atar', () => {
  assert.equal(resolveSafePath('/var/log/'), '/var/log');
  assert.equal(resolveSafePath('/var/log/../log'), '/var/log');
  assert.equal(resolveSafePath('/root/./x//y'), '/root/x/y');
  assert.equal(resolveSafePath('/'), '/');
});

test('assertMutable kritik sistem yollarını engeller', () => {
  for (const p of ['/', '/etc', '/root', '/var/lib/docker', '/usr', '/home']) {
    assert.throws(() => assertMutable(p), PathError, `${p} korunmalı`);
  }
});

test('assertMutable korumalı dizinin altındaki yollara izin verir', () => {
  assert.equal(assertMutable('/root/proje'), '/root/proje');
  assert.equal(assertMutable('/etc/nginx/nginx.conf'), '/etc/nginx/nginx.conf');
});

test('assertInside hedef dizinden kaçmayı engeller', () => {
  assert.equal(assertInside('/tmp/up', '/tmp/up/dosya.txt'), '/tmp/up/dosya.txt');
  assert.throws(() => assertInside('/tmp/up', '/tmp/up/../../etc/passwd'), PathError);
  assert.throws(() => assertInside('/tmp/up', '/etc/passwd'), PathError);
  // Aynı önekle başlayan komşu dizin de içeride sayılmamalı.
  assert.throws(() => assertInside('/tmp/up', '/tmp/upload/x'), PathError);
});

test('isVirtualFsPath yalnızca /proc, /sys, /dev ve altlarını yakalar', async () => {
  const { isVirtualFsPath } = await import('../src/files/routes.js');
  for (const p of ['/proc', '/proc/1', '/sys/class', '/dev']) assert.equal(isVirtualFsPath(p), true, p);
  for (const p of ['/', '/process', '/var', '/devices', '/root/proc']) assert.equal(isVirtualFsPath(p), false, p);
});

test('writeTarget korumalı dizinlerin içine yazmaya izin verir', async () => {
  // Regresyon: eskiden dizinin kendisi denetleniyordu ve /root, /tmp, /etc
  // içine hiç dosya yüklenemiyordu.
  const { writeTarget } = await import('../src/files/routes.js');
  assert.equal(writeTarget('/root', 'yedek.tar.gz', 'upload'), '/root/yedek.tar.gz');
  assert.equal(writeTarget('/tmp', 'a.txt', 'upload'), '/tmp/a.txt');
  assert.equal(writeTarget('/etc/nginx', 'site.conf', 'upload'), '/etc/nginx/site.conf');
});

test('writeTarget korumalı dosyanın üzerine yazmayı ve dizinden kaçmayı engeller', async () => {
  const { writeTarget } = await import('../src/files/routes.js');
  assert.throws(() => writeTarget('/etc', 'passwd', 'upload'), PathError);
  assert.throws(() => writeTarget('/var', 'log', 'upload'), PathError);
  assert.equal(writeTarget('/root', '../../etc/passwd', 'upload'), '/root/passwd');
  assert.equal(writeTarget('/root', '...', 'upload'), '/root/upload');
  assert.equal(writeTarget('/root', '', 'download'), '/root/download');
});

test('redirectTarget yalnızca http/https yönlendirmesine izin verir', async () => {
  // Regresyon: ftp:// yönlendirmesi http.get'i senkron fırlatıyor ve
  // backend süreci çöküyordu.
  const { redirectTarget } = await import('../src/files/routes.js');
  assert.equal(redirectTarget('/b', 'http://ornek.com/a'), 'http://ornek.com/b');
  assert.equal(redirectTarget('https://cdn.ornek.com/x', 'http://ornek.com/a'), 'https://cdn.ornek.com/x');
  assert.throws(() => redirectTarget('ftp://ornek.com/x', 'http://ornek.com/a'), /unsupported protocol/);
  assert.throws(() => redirectTarget('file:///etc/passwd', 'http://ornek.com/a'), /unsupported protocol/);
  assert.throws(() => redirectTarget('http://[bozuk', 'http://ornek.com/a'), /Invalid redirect/);
});
