import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSessions, readSavedMatch, defaultSessions } from '../src/timer/config.mjs';
import { createMatch } from '../src/timer/match.mjs';

test('supported legacy names normalize, including zero-duration covers', () => {
  assert.deepEqual(normalizeSessions([
    { title: '封面', duration: 0, isDualTimer: false },
    { 环节名称: '自由辩论', 环节用时: '120', 双人环节: '是', label1: '甲' },
  ]), [
    { title: '封面', duration: 0, isDualTimer: false },
    { title: '自由辩论', duration: 120, isDualTimer: true, label1: '甲' },
  ]);
  for (const value of [[], [null], [{ title: 'A', duration: -1, isDualTimer: false }]]) {
    assert.throws(() => normalizeSessions(value));
  }
});

test('bad saved data recovers and an out-of-range cursor resets', () => {
  assert.deepEqual(readSavedMatch(() => '{bad').sessions, defaultSessions);
  const saved = { debateTimerSessions: JSON.stringify(defaultSessions), debateTimerCurrentIndex: '9' };
  assert.equal(readSavedMatch(key => saved[key]).index, 0);
});

test('coaching preserves the saved match, and applying a shorter list resets the cursor', () => {
  const sessions = normalizeSessions(['A', 'B', 'C'].map(title => ({ title, duration: 60, isDualTimer: false })));
  const match = createMatch({ sessions, index: 2 });
  match.command('coach1', 0);
  assert.equal(match.snapshot(0).session.title, '教练指导');
  assert.deepEqual(match.saved().sessions, sessions);
  assert.equal(match.saved().index, 2);
  match.command('next', 0);
  assert.equal(match.snapshot(0).session.title, 'C');
  match.apply(sessions.slice(0, 1));
  assert.equal(match.snapshot(0).session.title, 'A');
  assert.equal(match.saved().index, 0);
});
