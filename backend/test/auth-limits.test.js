import test from 'node:test';
import assert from 'node:assert/strict';
import { durationToSeconds } from '../src/config.js';
import { lockDurationMs } from '../src/auth/routes.js';

test('durationToSeconds birim eklerini çözer', () => {
  assert.equal(durationToSeconds('30s'), 30);
  assert.equal(durationToSeconds('90m'), 5400);
  assert.equal(durationToSeconds('24h'), 86400);
  assert.equal(durationToSeconds('7d'), 604800);
});

test('durationToSeconds birimsiz değeri saniye sayar', () => {
  assert.equal(durationToSeconds('3600'), 3600);
  assert.equal(durationToSeconds(120), 120);
});

test('durationToSeconds anlaşılmayan girdide yedek değeri döner', () => {
  assert.equal(durationToSeconds('yarım saat'), 86400);
  assert.equal(durationToSeconds(undefined), 86400);
  assert.equal(durationToSeconds('', 60), 60);
});

const MINUTE = 60 * 1000;

test('kilit süresi her kilitlenmede ikiye katlanır', () => {
  assert.equal(lockDurationMs(1), 15 * MINUTE);
  assert.equal(lockDurationMs(2), 30 * MINUTE);
  assert.equal(lockDurationMs(3), 60 * MINUTE);
});

test('kilit süresi 24 saatte tavanlanır', () => {
  const DAY = 24 * 60 * MINUTE;
  assert.equal(lockDurationMs(10), DAY);
  assert.equal(lockDurationMs(100), DAY);
  // Tavan olmadan 2^1000 = Infinity dönüyordu: kalıcı kilit.
  assert.ok(Number.isFinite(lockDurationMs(1000)));
});
