import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createGroupStore, cleanGroupName, isContainerName } from '../src/docker/groups.js';
import { selfProjectOf } from '../src/docker/routes.js';

async function freshStore() {
  const dir = await mkdtemp(join(tmpdir(), 'sp-groups-'));
  const file = join(dir, 'groups.json');
  const store = createGroupStore(file);
  await store.load();
  return { store, file };
}

test('cleanGroupName boşlukları sadeleştirir, boş ve uzun adı reddeder', () => {
  assert.equal(cleanGroupName('  Web   siteleri '), 'Web siteleri');
  assert.equal(cleanGroupName('   '), null);
  assert.equal(cleanGroupName('x'.repeat(41)), null);
  assert.equal(cleanGroupName(42), null);
});

test('isContainerName yol ve özel karakterleri reddeder', () => {
  assert.ok(isContainerName('wordpick-api-1'));
  assert.ok(!isContainerName('../etc'));
  assert.ok(!isContainerName('a b'));
  assert.ok(!isContainerName(''));
});

test('grup oluşturma, atama ve diske yazma', async () => {
  const { store, file } = await freshStore();
  const g = await store.create('WordPick');
  await store.assign('wordpick-api-1', g.id);

  const reloaded = createGroupStore(file);
  await reloaded.load();
  assert.deepEqual(reloaded.get(), { groups: [g], assign: { 'wordpick-api-1': g.id } });
});

test('aynı adda ikinci grup oluşturulamaz (büyük/küçük harf duyarsız)', async () => {
  const { store } = await freshStore();
  await store.create('Demolar');
  await assert.rejects(store.create('demolar'), { status: 409 });
});

test('grup silinince atamaları da kalkar', async () => {
  const { store } = await freshStore();
  const g = await store.create('Geçici');
  await store.assign('demo_ai', g.id);
  await store.remove(g.id);
  assert.deepEqual(store.get(), { groups: [], assign: {} });
});

test('olmayan gruba atama 404 verir, null atama varsayılana döndürür', async () => {
  const { store } = await freshStore();
  await assert.rejects(store.assign('demo_ai', 'yok'), { status: 404 });
  const g = await store.create('A');
  await store.assign('demo_ai', g.id);
  await store.assign('demo_ai', null);
  assert.deepEqual(store.get().assign, {});
});

test('bozuk dosya boş durumla açılır, geçersiz kayıtlar ayıklanır', async () => {
  const { file } = await freshStore();
  await writeFile(file, JSON.stringify({
    groups: [{ id: 'g1', name: 'İyi' }, { id: 'g2', name: '' }, 'çöp'],
    assign: { 'ok-1': 'g1', 'yetim': 'g2', '../kötü': 'g1' },
  }));
  const store = createGroupStore(file);
  await store.load();
  assert.deepEqual(store.get(), { groups: [{ id: 'g1', name: 'İyi' }], assign: { 'ok-1': 'g1' } });

  await writeFile(file, '{bozuk');
  await store.load();
  assert.deepEqual(store.get(), { groups: [], assign: {} });
  assert.ok((await readFile(file, 'utf8')).startsWith('{bozuk'));
});

test('selfProjectOf hostname ile panelin compose projesini bulur', () => {
  const containers = [
    { Id: 'aaa111222333ffff', Labels: { 'com.docker.compose.project': 'wordpick' } },
    { Id: 'bbb111222333ffff', Labels: { 'com.docker.compose.project': 'serverpanel' } },
  ];
  assert.equal(selfProjectOf(containers, 'bbb111222333'), 'serverpanel');
  assert.equal(selfProjectOf(containers, 'yok'), null);
});
