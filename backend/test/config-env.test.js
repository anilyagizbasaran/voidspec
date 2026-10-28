import test from 'node:test';
import assert from 'node:assert/strict';

// config.js sırları yüklenirken okuyor; değerler import'tan önce kurulmalı.
const SECRET = 'x'.repeat(40);
const HASH = '$2b$12$' + 'a'.repeat(53);
process.env.JWT_SECRET = SECRET;
process.env.ADMIN_PASSWORD_HASH = HASH;
const { config } = await import('../src/config.js');

test('sırlar config\'e alınır ve alt süreçlere geçmesin diye ortamdan silinir', () => {
  assert.equal(config.jwtSecret, SECRET);
  assert.equal(config.adminPasswordHash, HASH);
  assert.equal(process.env.JWT_SECRET, undefined);
  assert.equal(process.env.ADMIN_PASSWORD_HASH, undefined);
});
