import { createClock } from './engine.mjs';
import { normalizeSessions, safeIndex } from './config.mjs';

export const matchActions = new Set(['primary', 'secondary', 'pause', 'reset', 'previous', 'next', 'coach1', 'coach2']);

export function createMatch(saved) {
  let sessions = saved.sessions;
  let index = safeIndex(saved.index, sessions);
  let coaching = null;
  let stage = sessions[index];
  let clock = createClock(stage);

  function selectStage() {
    stage = coaching ? { title: '教练指导', duration: coaching, isDualTimer: false } : sessions[index];
    clock = createClock(stage);
  }

  return {
    command(action, now) {
      if (action === 'coach1' || action === 'coach2') {
        const duration = action === 'coach1' ? 60 : 120;
        coaching = coaching === duration ? null : duration;
        selectStage();
      } else if (action === 'previous' || action === 'next') {
        if (coaching) coaching = null;
        else if (sessions.length === 1) return;
        else index = (index + (action === 'next' ? 1 : -1) + sessions.length) % sessions.length;
        selectStage();
      } else {
        clock.command(action, now);
      }
    },
    apply(value) {
      sessions = normalizeSessions(value);
      index = 0;
      coaching = null;
      selectStage();
    },
    saved: () => ({ sessions, index }),
    snapshot: now => ({ session: { label1: '正方', label2: '反方', ...stage }, ...clock.snapshot(now) }),
    nextDeadline: () => clock.nextDeadline(),
  };
}
