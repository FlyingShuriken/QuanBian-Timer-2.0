import JSZip from 'jszip';
import { normalizeSessions, appearance } from './config.mjs';
import { assetFields, assertAsset, maxAssetBytes, maxArchiveBytes } from './assets.mjs';

function readEntry(entry, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const stream = entry.internalStream('uint8array');
    stream.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        stream.pause();
        reject(new Error('ZIP 内的文件过大'));
      } else {
        chunks.push(chunk);
      }
    }).on('error', reject).on('end', () => {
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(bytes);
    }).resume();
  });
}

const archiveNames = {
  coverBackground: /^cover\.(png|jpe?g|gif|webp)$/i,
  defaultBackground: /^background\.(png|jpe?g|gif|webp)$/i,
  customFontPath: /\.(ttf|otf|woff2?)$/i,
};

export async function importPackage(buffer) {
  if (buffer.byteLength > maxArchiveBytes) throw new Error('ZIP 文件过大');
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);
  if (entries.length > 64 || !zip.file('config.json')) throw new Error('ZIP 缺少有效的 config.json');
  const config = JSON.parse(new TextDecoder().decode(await readEntry(zip.file('config.json'), 512 * 1024)));
  const sessions = normalizeSessions(config.sessions);
  const settings = appearance(config.settings);
  const assets = {};
  for (const field of assetFields) {
    const entry = entries.find(item => !item.dir && !item.name.startsWith('__MACOSX/') &&
      archiveNames[field].test(item.name));
    if (!entry) continue;
    const bytes = await readEntry(entry, maxAssetBytes);
    const format = assertAsset(field, bytes);
    assets[field] = bytes;
    if (field === 'customFontPath') {
      settings.customFontFamily = 'DebateCustom';
      settings.customFontFormat = format;
    }
  }
  return { sessions, settings, assets };
}

export async function exportPackage(sessions, settings, readAsset) {
  const zip = new JSZip();
  zip.file('config.json', JSON.stringify({ sessions: normalizeSessions(sessions), settings: appearance(settings) }, null, 2));
  for (const field of assetFields) {
    const bytes = await readAsset(field);
    if (!bytes) continue;
    const format = assertAsset(field, bytes);
    const basename = { coverBackground: 'cover', defaultBackground: 'background', customFontPath: 'font' }[field];
    zip.file(`${basename}.${format}`, bytes);
    if (field === 'customFontPath') {
      zip.file('font-metadata.json', JSON.stringify({ family: 'DebateCustom', format }));
    }
  }
  return zip.generateAsync({ type: 'uint8array' });
}
