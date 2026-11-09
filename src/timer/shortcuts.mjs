const shortcuts = new Map(Object.entries({
  q: 'primary', w: 'secondary', r: 'reset', p: 'pause',
  ',': 'previous', '.': 'next', 1: 'coach1', 2: 'coach2',
}));

export function matchShortcut(event) {
  if (event.defaultPrevented || event.repeat || event.isComposing ||
      event.altKey || event.ctrlKey || event.metaKey ||
      event.target?.isContentEditable ||
      event.target?.closest?.('input, textarea, select, button, [role="dialog"]')) return;
  return shortcuts.get(event.key.toLowerCase());
}
