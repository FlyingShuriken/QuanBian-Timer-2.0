import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assetFields, assetTypes, assertAsset, maxAssetBytes } from '../src/timer/assets.mjs';
import { defaultSessions, defaultSettings, normalizeSessions, safeIndex } from '../src/timer/config.mjs';
import { appearance } from '../src/timer/packages.mjs';

const assetId = /^[a-f\d]{64}\.(png|jpg|gif|webp|ttf|otf|woff2?)$/;
const assetPath = '/assets/';

export function createStorage(root) {
  const assetsDir = join(root, 'assets');
  mkdirSync(assetsDir, { recursive: true });
  const configPath = join(root, 'match.json');

  function readAsset(id) {
    if (typeof id !== 'string' || !assetId.test(id)) return;
    try {
      return { bytes: readFileSync(join(assetsDir, id)), type: assetTypes[id.split('.').pop()] };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  function restoreSettings(value) {
    const settings = appearance(value);
    for (const field of assetFields) {
      const url = value?.[field];
      if (typeof url !== 'string' || !url.startsWith(assetPath)) continue;
      const id = url.slice(assetPath.length);
      const asset = readAsset(id);
      if (!asset || !asset.type.startsWith(field === 'customFontPath' ? 'font/' : 'image/')) continue;
      settings[field] = url;
      if (field === 'customFontPath') {
        settings.customFontFamily = 'DebateCustom';
        settings.customFontFormat = id.split('.').pop();
      }
    }
    return settings;
  }

  function write(config) {
    const temporary = join(root, `match-${randomUUID()}.tmp`);
    try {
      writeFileSync(temporary, JSON.stringify(config));
      renameSync(temporary, configPath);
    } finally {
      rmSync(temporary, { force: true });
    }
    return config;
  }

  return {
    read() {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        const sessions = normalizeSessions(config.sessions);
        return { sessions, settings: restoreSettings(config.settings), index: safeIndex(config.index, sessions) };
      } catch (error) {
        if (error.code && error.code !== 'ENOENT') throw error;
        return { sessions: defaultSessions, settings: defaultSettings, index: 0 };
      }
    },
    readAsset,
    write,
    apply({ sessions: raw, settings: requested, assets = {} }) {
      const sessions = normalizeSessions(raw);
      const settings = restoreSettings(requested);
      const files = [];
      for (const field of assetFields) {
        const value = assets[field];
        if (value === undefined) continue;
        if (typeof value !== 'string' || value.length > Math.ceil(maxAssetBytes / 3) * 4 ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('图片或字体数据无效');
        const bytes = Buffer.from(value, 'base64');
        const format = assertAsset(field, bytes);
        const id = `${createHash('sha256').update(bytes).digest('hex')}.${format}`;
        files.push({ id, bytes });
        settings[field] = assetPath + id;
        if (field === 'customFontPath') {
          settings.customFontFamily = 'DebateCustom';
          settings.customFontFormat = format;
        }
      }
      for (const { id, bytes } of files) {
        try {
          writeFileSync(join(assetsDir, id), bytes, { flag: 'wx' });
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
        }
      }
      return write({ sessions, settings, index: 0 });
    },
  };
}
