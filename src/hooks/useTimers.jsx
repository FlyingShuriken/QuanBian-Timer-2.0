import { useCallback, useEffect, useState } from 'react';
import { createClock } from '../timer/engine.mjs';

export function useTimers(session) {
  const [clock] = useState(() => createClock(session));
  const [state, setState] = useState(() => clock.snapshot(0));

  useEffect(() => {
    if (state.running === null) return;
    const id = setInterval(() => setState(clock.snapshot(performance.now())), 50);
    return () => clearInterval(id);
  }, [clock, state.running]);

  const command = useCallback(action => {
    const now = performance.now();
    clock.command(action, now);
    setState(clock.snapshot(now));
  }, [clock]);

  return { ...state, command };
}
