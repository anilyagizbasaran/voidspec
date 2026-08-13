import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';

// hostfs.js modül yüklenirken HOST_FS_ROOT'u okuyup dizinin varlığını
// doğruluyor. Testte gerçek bir dizin (repo kökü) kullanıyoruz.
const ROOT = path.resolve(import.meta.dirname, '..');
process.env.HOST_FS_ROOT = ROOT;
const { toFs, toLogical, hostFsEnabled, HOST_ROOT } = await import('../src/lib/hostfs.js');

test('HOST_FS_ROOT var olan bir dizinse çeviri etkinleşir', () => {
  assert.equal(hostFsEnabled, true);
  assert.equal(HOST_ROOT, ROOT);
});

test('toFs mantıksal host yolunu konteyner yoluna çevirir', () => {
  assert.equal(toFs('/etc/nginx/nginx.conf'), `${ROOT}/etc/nginx/nginx.conf`);
  assert.equal(toFs('/var/www'), `${ROOT}/var/www`);
});

test('toFs kök dizini çift slash üretmeden çevirir', () => {
  assert.equal(toFs('/'), ROOT);
});

test('toLogical çeviriyi geri alır', () => {
  assert.equal(toLogical(`${ROOT}/etc/hosts`), '/etc/hosts');
  assert.equal(toLogical(ROOT), '/');
});

test('toLogical kök dışındaki yolu olduğu gibi bırakır', () => {
  assert.equal(toLogical('/başka/yer'), '/başka/yer');
});

test('toFs/toLogical birbirinin tersi', () => {
  for (const p of ['/', '/etc', '/var/log/syslog', '/root/.ssh/authorized_keys']) {
    assert.equal(toLogical(toFs(p)), p);
  }
});

test('HOST_FS_ROOT var olmayan bir yol ise çeviri devre dışı kalır', async () => {
  process.env.HOST_FS_ROOT = '/böyle-bir-dizin-yok-12345';
  // Modül cache'ini atlatmak için sorgu parametresiyle yeniden yükle.
  const mod = await import('../src/lib/hostfs.js?disabled=1');
  assert.equal(mod.hostFsEnabled, false);
  assert.equal(mod.toFs('/etc'), '/etc');
  assert.equal(mod.toLogical('/etc'), '/etc');
});
