import assert from 'node:assert/strict';
import test from 'node:test';
import { matchShortcut } from '../src/timer/shortcuts.mjs';

test('a match key resolves to one command and is ignored during editing', () => {
  assert.equal(matchShortcut({ key: '.' }), 'next');
  assert.equal(matchShortcut({ key: 'R' }), 'reset');
  assert.equal(matchShortcut({ key: '1', target: { closest: () => true } }), undefined);
  assert.equal(matchShortcut({ key: '.', repeat: true }), undefined);
  assert.equal(matchShortcut({ key: 'q', ctrlKey: true }), undefined);
});
