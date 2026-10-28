import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUsername, validatePassword, isValidSSHKey } from '../src/users/routes.js';
import { validatePkg } from '../src/packages/routes.js';
import { validateService } from '../src/services/routes.js';
import { buildJournalArgs } from '../src/logs/routes.js';

test('validateUsername kabul edilebilir adlara izin verir', () => {
  for (const ok of ['deploy', 'web_user', 'a', 'x-1', '_svc']) {
    assert.doesNotThrow(() => validateUsername(ok), `${ok} geçerli olmalı`);
  }
});

test('validateUsername kabuk metakarakterlerini reddeder', () => {
  for (const bad of ['', 'Root', 'a b', 'user;rm -rf /', '$(id)', '`id`', 'a'.repeat(33), '../x']) {
    assert.throws(() => validateUsername(bad), `${bad} reddedilmeli`);
  }
});

test('validatePassword kısa parolayı ve satır sonunu reddeder', () => {
  assert.doesNotThrow(() => validatePassword('uzun-parola:1'));
  // Regresyon: chpasswd'ye giden "kullanıcı:parola\n" satırına ikinci bir
  // satır eklenip root'un parolası değiştirilebiliyordu.
  for (const bad of ['kisa', '', undefined, 12345678, 'parola12\nroot:ele-gecirildi', 'parola12\rx', 'parola12\0x']) {
    assert.throws(() => validatePassword(bad), JSON.stringify(bad));
  }
});

test('isValidSSHKey tek satırlık geçerli anahtarı kabul eder', () => {
  assert.equal(isValidSSHKey('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5 yagiz@laptop'), true);
  assert.equal(isValidSSHKey('ssh-rsa AAAAB3NzaC1yc2EAAAA'), true);
});

test('isValidSSHKey bozuk ve çok satırlı anahtarları reddeder', () => {
  assert.equal(isValidSSHKey('rm -rf /'), false);
  assert.equal(isValidSSHKey('ssh-ed25519'), false);
  assert.equal(isValidSSHKey('ssh-ed25519 AAAA$(id) yorum'), false);
  // Çok satırlı girdi ile authorized_keys'e ekstra satır enjekte edilemesin.
  assert.equal(isValidSSHKey('ssh-ed25519 AAAA yorum\nssh-rsa BBBB saldırgan'), false);
});

test('validatePkg paket adlarını doğrular', () => {
  assert.doesNotThrow(() => validatePkg('nginx'));
  assert.doesNotThrow(() => validatePkg('libssl3'));
  assert.doesNotThrow(() => validatePkg('g++'));
  for (const bad of ['', 'Nginx', 'nginx; rm -rf /', 'a b', '$(id)', '../etc']) {
    assert.throws(() => validatePkg(bad), `${bad} reddedilmeli`);
  }
});

test('validateService yalnızca .service birimlerini kabul eder', () => {
  assert.doesNotThrow(() => validateService('nginx.service'));
  assert.doesNotThrow(() => validateService('getty@tty1.service'));
  for (const bad of ['nginx', 'nginx.socket', '../x.service', 'a b.service', 'x.service;id']) {
    assert.throws(() => validateService(bad), `${bad} reddedilmeli`);
  }
});

test('buildJournalArgs aramayı journalctl -g ile yapar', () => {
  const args = buildJournalArgs({ lines: '50', search: 'oom', unit: 'nginx.service' });
  assert.ok(args.includes('-g'), 'arama journalctl tarafında yapılmalı');
  assert.equal(args[args.indexOf('-g') + 1], 'oom');
  assert.equal(args[args.indexOf('-u') + 1], 'nginx.service');
  assert.equal(args[args.indexOf('-n') + 1], '50');
});

test('buildJournalArgs satır sayısını sınırlar ve birim adını temizler', () => {
  const args = buildJournalArgs({ lines: '99999', unit: 'ngi;nx.service' });
  assert.equal(args[args.indexOf('-n') + 1], '2000');
  assert.equal(args[args.indexOf('-u') + 1], 'nginx.service');
});

test('sshKeysRaw: dosya yoksa boş, diğer hatalarda fırlatır', async () => {
  const { sshKeysRaw } = await import('../src/users/routes.js');
  assert.equal(sshKeysRaw({ ok: true, stdout: 'ssh-ed25519 AAA x', stderr: '' }), 'ssh-ed25519 AAA x');
  assert.equal(sshKeysRaw({ ok: false, stdout: '', stderr: 'cat: /h/.ssh/authorized_keys: No such file or directory' }), '');
  assert.throws(() => sshKeysRaw({ ok: false, stdout: '', stderr: 'Permission denied' }), /could not read/);
});
