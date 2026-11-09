export const defaultSessions = [{ title: '请选择赛制', duration: 1, isDualTimer: false }];

export const defaultSettings = {
  coverBackground: '/cover.png',
  defaultBackground: '/background.png',
  positiveColor: '#23C1FF',
  negativeColor: '#AEF359',
  fontStyle: 'font-sans',
  customFontPath: '',
  customFontFamily: '',
  customFontFormat: '',
};

export function normalizeSessions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) {
    throw new Error('赛制必须包含 1 至 500 个环节');
  }
  return value.map((stage, index) => {
    const rawTitle = stage?.title ?? stage?.环节名称;
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    const rawDuration = stage?.duration ?? stage?.时长 ?? stage?.环节用时;
    const duration = typeof rawDuration === 'string' && /^\d+$/.test(rawDuration.trim())
      ? Number(rawDuration) : rawDuration;
    const dual = stage?.isDualTimer ?? stage?.双方环节 ?? stage?.双人环节;
    const isDualTimer = dual === '是' ? true : dual === '否' ? false : dual;
    if (!title || title.length > 200 || !Number.isInteger(duration) || duration < 0 ||
        duration > 86400 || (duration === 0 && title !== '封面') || typeof isDualTimer !== 'boolean') {
      throw new Error(`第 ${index + 1} 个环节的名称、时长或计时类型无效`);
    }
    const result = { title, duration, isDualTimer };
    for (const key of ['label1', 'label2']) {
      if (stage[key] === undefined || stage[key] === '') continue;
      if (typeof stage[key] !== 'string' || stage[key].length > 80) {
        throw new Error(`第 ${index + 1} 个环节的队伍名称无效`);
      }
      result[key] = stage[key];
    }
    return result;
  });
}

export function safeIndex(index, sessions) {
  return Number.isInteger(index) && index >= 0 && index < sessions.length ? index : 0;
}

export function appearance(value) {
  const safe = { ...defaultSettings };
  for (const key of ['positiveColor', 'negativeColor']) {
    if (value?.[key] === undefined) continue;
    if (typeof value[key] !== 'string' || !/^#[a-f\d]{6}$/i.test(value[key])) {
      throw new Error('队伍颜色必须是六位十六进制颜色');
    }
    safe[key] = value[key];
  }
  if (['font-sans', 'font-serif', 'font-mono'].includes(value?.fontStyle)) safe.fontStyle = value.fontStyle;
  return safe;
}
