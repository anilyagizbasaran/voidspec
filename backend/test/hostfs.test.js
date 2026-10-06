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

test('resolveHostPath mutlak symlink\'i host kökü içinde çözer', async () => {
  const { mkdtemp, mkdir, writeFile, symlink, rm } = await import('fs/promises');
  const os = await import('os');
  const root = await mkdtemp(path.join(os.tmpdir(), 'hostfs-'));
  process.env.HOST_FS_ROOT = root;
  const mod = await import('../src/lib/hostfs.js?symlink=1');
  try {
    await mkdir(`${root}/etc/nginx/sites-available`, { recursive: true });
    await mkdir(`${root}/etc/nginx/sites-enabled`, { recursive: true });
    await writeFile(`${root}/etc/nginx/sites-available/pano`, 'server {}');
    await symlink('/etc/nginx/sites-available/pano', `${root}/etc/nginx/sites-enabled/pano`);
    await symlink('../sites-available', `${root}/etc/nginx/sites-enabled/rel`);
    await symlink('/etc/loop', `${root}/etc/loop`);

    assert.equal(await mod.resolveHostPath('/etc/nginx/sites-enabled/pano'), '/etc/nginx/sites-available/pano');
    // Bağlantının kendisi (sil/taşı için)
    assert.equal(
      await mod.resolveHostPath('/etc/nginx/sites-enabled/pano', { followLast: false }),
      '/etc/nginx/sites-enabled/pano',
    );
    // Göreli symlink ve ara bileşendeki symlink
    assert.equal(await mod.resolveHostPath('/etc/nginx/sites-enabled/rel/pano'), '/etc/nginx/sites-available/pano');
    // Var olmayan kuyruk olduğu gibi eklenir
    assert.equal(await mod.resolveHostPath('/etc/nginx/sites-enabled/rel/yeni.conf'), '/etc/nginx/sites-available/yeni.conf');
    // Kökün üstüne çıkılamaz
    assert.equal(await mod.resolveHostPath('/../../etc/nginx'), '/etc/nginx');
    await assert.rejects(mod.resolveHostPath('/etc/loop'), /symbolic links/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
