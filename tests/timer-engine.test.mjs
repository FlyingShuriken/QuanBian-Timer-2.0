import assert from 'node:assert/strict';
import test from 'node:test';
import { createClock } from '../src/timer/engine.mjs';

test('pause and first resume preserve the remaining time', () => {
  const clock = createClock({ duration: 10, isDualTimer: false });
  clock.command('primary', 0);
  clock.command('primary', 1250);
  assert.deepEqual(clock.snapshot(5000).remainingMs, [8750]);
  clock.command('primary', 5000);
  assert.deepEqual(clock.snapshot(5500), { remainingMs: [8250], running: 0, paused: false });
});

test('handoff occurs at expiry, accounts for a delayed tick, and works from either side', () => {
  for (const first of [0, 1]) {
    const clock = createClock({ duration: 2, isDualTimer: true });
    clock.command(first === 0 ? 'primary' : 'secondary', 0);
    assert.equal(clock.snapshot(1999).remainingMs[first], 1);
    assert.equal(clock.snapshot(1999).running, first);
    assert.equal(clock.snapshot(2250).running, 1 - first);
    assert.equal(clock.snapshot(2250).remainingMs[1 - first], 1750);
    assert.deepEqual(clock.snapshot(4000), { remainingMs: [0, 0], running: null, paused: false });
  }
});

test('emergency pause blocks starts and reset keeps the pause overlay', () => {
  const clock = createClock({ duration: 5, isDualTimer: false });
  clock.command('primary', 0);
  clock.command('secondary', 100);
  assert.equal(clock.snapshot(100).running, 0);
  clock.command('pause', 100);
  clock.command('primary', 150);
  clock.command('reset', 200);
  assert.deepEqual(clock.snapshot(300), { remainingMs: [5000], running: null, paused: true });
  clock.command('pause', 300);
  assert.equal(clock.snapshot(400).running, null);
});
