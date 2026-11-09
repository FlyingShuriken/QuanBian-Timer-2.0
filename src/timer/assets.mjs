export const assetFields = ['coverBackground', 'defaultBackground', 'customFontPath'];
export const maxAssetBytes = 8 * 1024 * 1024;
export const maxArchiveBytes = 3 * maxAssetBytes + 512 * 1024;
export const assetTypes = {
  png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
};

export function assetFormat(bytes) {
  const hex = Array.from(bytes.subarray(0, 12), value => value.toString(16).padStart(2, '0')).join('');
  if (bytes.length < 16) return;
  if (hex.startsWith('89504e470d0a1a0a')) return 'png';
  if (hex.startsWith('ffd8ff')) return 'jpg';
  if (/^474946383[79]61/.test(hex)) return 'gif';
  if (/^52494646........57454250/.test(hex)) return 'webp';
  if (hex.startsWith('00010000')) return 'ttf';
  if (hex.startsWith('4f54544f')) return 'otf';
  if (hex.startsWith('774f4646')) return 'woff';
  if (hex.startsWith('774f4632')) return 'woff2';
}

export function assertAsset(field, bytes) {
  const format = assetFormat(bytes);
  const type = assetTypes[format];
  if (!assetFields.includes(field) || bytes.length > maxAssetBytes || !type ||
      !type.startsWith(field === 'customFontPath' ? 'font/' : 'image/')) {
    throw new Error('图片或字体格式无效，或超过 8 MB');
  }
  return format;
}
