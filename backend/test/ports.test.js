import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSsOutput } from '../src/system/routes.js';

const SAMPLE = `Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
udp   UNCONN 0      0         127.0.0.53%lo:53        0.0.0.0:*    users:(("systemd-resolve",pid=292677,fd=14))
udp   UNCONN 0      0               0.0.0.0:51820     0.0.0.0:*
tcp   LISTEN 0      511             0.0.0.0:8080      0.0.0.0:*    users:(("docker-proxy",pid=1750452,fd=4))
tcp   LISTEN 0      4096               [::]:22           [::]:*    users:(("sshd",pid=1234,fd=3))
tcp   ESTAB  0      0            10.0.0.1:44322     10.0.0.2:443`;

test('parseSsOutput dinlenen tcp/udp portlarını çıkarır', () => {
  const ports = parseSsOutput(SAMPLE);
  const numbers = ports.map(p => p.localPort);
  assert.deepEqual(numbers, [22, 53, 8080, 51820]);
});

test('parseSsOutput süreç adı ve pid\'i okur', () => {
  const http = parseSsOutput(SAMPLE).find(p => p.localPort === 8080);
  assert.equal(http.process, 'docker-proxy');
  assert.equal(http.pid, 1750452);
  assert.equal(http.localAddress, '0.0.0.0');
});

test('parseSsOutput IPv6 adresini doğru ayırır', () => {
  const ssh = parseSsOutput(SAMPLE).find(p => p.localPort === 22);
  assert.equal(ssh.localAddress, '[::]');
  assert.equal(ssh.process, 'sshd');
});

test('parseSsOutput dinlemeyen bağlantıları ve başlığı atlar', () => {
  const ports = parseSsOutput(SAMPLE);
  assert.equal(ports.some(p => p.localPort === 44322), false);
  assert.equal(ports.some(p => p.protocol === 'Netid'), false);
});

test('parseSsOutput süreç bilgisi olmayan satırı da döndürür', () => {
  const wg = parseSsOutput(SAMPLE).find(p => p.localPort === 51820);
  assert.equal(wg.process, '');
  assert.equal(wg.pid, null);
});
