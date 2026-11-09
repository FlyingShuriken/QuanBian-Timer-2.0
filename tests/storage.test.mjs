import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import { createStorage } from '../server/storage.mjs';
import { defaultSessions, defaultSettings } from '../src/timer/config.mjs';
import { importPackage, exportPackage } from '../src/timer/packages.mjs';
import { maxAssetBytes } from '../src/timer/assets.mjs';

test('legacy ZIP, host restart, and ZIP re-export preserve images and fonts', async t => {
  const root = mkdtempSync(join(tmpdir(), 'timer-storage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cover = readFileSync(new URL('../public/cover.png', import.meta.url));
  const font = readFileSync(new URL('../node_modules/@fontsource/oswald/files/oswald-latin-700-normal.woff2', import.meta.url));
  const legacy = new JSZip();
  legacy.file('config.json', JSON.stringify({ sessions: defaultSessions, settings: defaultSettings }));
  legacy.file('cover.png', cover);
  legacy.file('font.woff2', font);
  const imported = await importPackage(await legacy.generateAsync({ type: 'uint8array' }));
  const storage = createStorage(root);
  const applied = storage.apply({ ...imported, assets: Object.fromEntries(
    Object.entries(imported.assets).map(([field, bytes]) => [field, Buffer.from(bytes).toString('base64')]),
  ) });
  const reopened = createStorage(root);
  assert.deepEqual(reopened.read(), applied);
  const output = await exportPackage(applied.sessions, applied.settings, field =>
    reopened.readAsset(applied.settings[field].split('/').pop())?.bytes);
  const roundTrip = await importPackage(output);
  assert.deepEqual(Buffer.from(roundTrip.assets.coverBackground), cover);
  assert.deepEqual(Buffer.from(roundTrip.assets.customFontPath), font);
  assert.equal(reopened.readAsset('../match.json'), undefined);
  assert.throws(() => reopened.apply({ sessions: [], settings: {} }));
  assert.throws(() => reopened.apply({ sessions: defaultSessions, assets: { coverBackground: 'dGVzdA==' } }));
  assert.deepEqual(reopened.read(), applied);
});

test('ZIP rejects a file whose actual expanded size exceeds the limit', async () => {
  const zip = new JSZip();
  zip.file('config.json', JSON.stringify({ sessions: defaultSessions }));
  zip.file('cover.png', new Uint8Array(maxAssetBytes + 1));
  const data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  assert.ok(data.byteLength < maxAssetBytes);
  await assert.rejects(importPackage(data), /文件过大/);
});
