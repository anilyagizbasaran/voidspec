import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLine } from '../src/cron/routes.js';

test('parseLine standart root crontab satırını çözer', () => {
  const job = parseLine('0 3 * * * /usr/bin/backup.sh --full', 'root', 4);
  assert.equal(job.schedule, '0 3 * * *');
  assert.equal(job.command, '/usr/bin/backup.sh --full');
  assert.equal(job.user, null);
  assert.equal(job.enabled, true);
  assert.equal(job.editable, true);
  assert.equal(job.id, 'root:4');
});

test('parseLine @reboot gibi özel zamanlamaları çözer', () => {
  const job = parseLine('@reboot /opt/start.sh', 'root', 0);
  assert.equal(job.schedule, '@reboot');
  assert.equal(job.command, '/opt/start.sh');
});

test('parseLine /etc/crontab satırında kullanıcı alanını ayırır', () => {
  const job = parseLine('17 * * * * root cd / && run-parts --report /etc/cron.hourly', 'system', 2, true);
  assert.equal(job.user, 'root');
  assert.equal(job.command, 'cd / && run-parts --report /etc/cron.hourly');
  assert.equal(job.editable, false);
});

test('parseLine devre dışı root satırını korur, sistem yorumlarını atar', () => {
  const disabled = parseLine('# 0 5 * * * /tmp/x.sh', 'root', 1);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.command, '/tmp/x.sh');

  assert.equal(parseLine('# 17 * * * * root /tmp/x.sh', 'system', 1, true), null);
});

test('parseLine cron olmayan satırlarda null döner', () => {
  assert.equal(parseLine('', 'root', 0), null);
  assert.equal(parseLine('   ', 'root', 0), null);
  assert.equal(parseLine('PATH=/usr/bin:/bin', 'root', 0), null);
  assert.equal(parseLine('0 3 * * *', 'root', 0), null); // komut yok
});

test('parseLine ham satırı olduğu gibi saklar (eşzamanlılık kontrolü için)', () => {
  const raw = '  0 3 * * * /usr/bin/backup.sh  ';
  assert.equal(parseLine(raw, 'root', 0).raw, raw);
});

test('crontabLinesFromResult: okuma hatasında boş liste yerine fırlatır', async () => {
  const { crontabLinesFromResult } = await import('../src/cron/routes.js');
  assert.deepEqual(crontabLinesFromResult({ ok: true, stdout: 'a\nb', stderr: '' }), ['a', 'b']);
  assert.deepEqual(crontabLinesFromResult({ ok: false, stdout: '', stderr: 'no crontab for root' }), []);
  assert.throws(() => crontabLinesFromResult({ ok: false, stdout: '', stderr: 'nsenter: timed out' }), /could not read/);
});
