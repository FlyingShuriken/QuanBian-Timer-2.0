import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WebSocket } from 'ws';
import { installMatch } from '../server/match.mjs';
import { createStorage } from '../server/storage.mjs';
import { displayTime } from '../src/timer/display-time.mjs';

async function start(root) {
  const server = createServer();
  const match = installMatch(server, createStorage(root), { lanHost: '127.0.0.1' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url, credential: match.credential,
    async close() {
      match.close();
      server.close();
      await once(server, 'close');
    },
  };
}

function viewer(url) {
  const socket = new WebSocket(url.replace(/^http/, 'ws') + '/ws/display', { origin: url });
  let latest;
  const events = [];
  socket.on('message', data => {
    const value = JSON.parse(data.toString());
    if (value.type !== 'snapshot') return;
    latest = value;
    for (const listener of events) listener(value);
  });
  return {
    socket,
    waitFor(predicate) {
      if (latest && predicate(latest)) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const remove = () => events.splice(events.indexOf(listener), 1);
        const deadline = setTimeout(() => {
          remove();
          reject(new Error(`Expected snapshot, last was ${JSON.stringify(latest)}`));
        }, 5000);
        const listener = value => {
          if (!predicate(value)) return;
          clearTimeout(deadline);
          remove();
          resolve(value);
        };
        events.push(listener);
      });
    },
  };
}

function post(url, path, body, cookie, origin = url) {
  return fetch(url + '/api/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

test('host authorizes a controller, fans out state, and restores the saved stage stopped', async t => {
  const root = mkdtempSync(join(tmpdir(), 'timer-lan-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  let host = await start(root);
  t.after(() => host.close());
  const { url, credential } = host;
  const first = viewer(url);
  const second = viewer(url);
  const initial = await first.waitFor(() => true);
  assert.equal((await second.waitFor(() => true)).instance, initial.instance);
  assert.equal((await post(url, 'command', { action: 'next' })).status, 401);
  assert.equal((await post(url, 'operator', { credential }, undefined, 'http://wrong.invalid')).status, 403);
  assert.equal((await fetch(url + '/api/config')).status, 401);
  const login = await post(url, 'operator', { credential });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const status = await fetch(url + '/api/operator', { headers: { Cookie: cookie } });
  assert.deepEqual(await status.json(), { authorized: true, displayUrl: url + '/display' });
  const sessions = [
    { title: 'Opening', duration: 1, isDualTimer: true },
    { title: 'Closing', duration: 30, isDualTimer: false },
  ];
  assert.equal((await post(url, 'config', { sessions }, cookie)).status, 200);
  first.socket.send(JSON.stringify({ action: 'next' }));
  assert.equal((await post(url, 'command', { action: 'primary' }, cookie)).status, 200);
  assert.equal((await first.waitFor(value => value.running === 0)).session.title, 'Opening');
  assert.equal((await second.waitFor(value => value.running === 1)).remainingMs[0], 0);
  first.socket.close();
  assert.equal((await post(url, 'command', { action: 'next' }, cookie)).status, 200);
  assert.equal((await second.waitFor(value => value.session.title === 'Closing')).running, null);
  const rejoined = viewer(url);
  assert.equal((await rejoined.waitFor(() => true)).session.title, 'Closing');
  assert.equal((await post(url, 'command', { action: 'coach1' }, cookie)).status, 200);
  assert.equal((await second.waitFor(value => value.session.title === '教练指导')).remainingMs[0], 60000);
  assert.equal((await post(url, 'config', { sessions: [] }, cookie)).status, 400);
  assert.equal((await fetch(url + '/assets/%2e%2e%2fmatch.json')).status, 404);
  await host.close();
  host = await start(root);
  const restored = await viewer(host.url).waitFor(() => true);
  assert.notEqual(restored.instance, initial.instance);
  assert.equal(restored.session.title, 'Closing');
  assert.equal(restored.running, null);
  assert.equal((await post(host.url, 'command', { action: 'next' }, cookie)).status, 401);
});

test('display extrapolates only the active clock and freezes after a stale feed', () => {
  const sample = {
    receivedAt: 100, offset: 1000,
    snapshot: { sampledAt: 1100, remainingMs: [5000, 5000], running: 0 },
  };
  assert.deepEqual(displayTime(sample, 250), { stale: false, remainingMs: [4850, 5000] });
  assert.deepEqual(displayTime(sample, 5000), { stale: true, remainingMs: [2000, 5000] });
  assert.deepEqual(displayTime({ ...sample, snapshot: { ...sample.snapshot, remainingMs: [10, 5000] } }, 5000),
    { stale: true, remainingMs: [0, 5000] });
});
