export function createClock({ duration, isDualTimer }) {
  const initial = Array(isDualTimer ? 2 : 1).fill(duration * 1000);
  let remaining = [...initial];
  let running = null;
  let deadline = null;
  let paused = false;

  function settle(now) {
    while (running !== null && now >= deadline) {
      remaining[running] = 0;
      const other = 1 - running;
      running = remaining[other] > 0 ? other : null;
      deadline = running === null ? null : deadline + remaining[running];
    }
  }

  function stop(now) {
    if (running !== null) remaining[running] = Math.max(0, deadline - now);
    running = deadline = null;
  }

  return {
    command(action, now) {
      settle(now);
      if (action === 'reset') {
        stop(now);
        remaining = [...initial];
      } else if (action === 'pause') {
        stop(now);
        paused = !paused;
      } else if (!paused && (action === 'primary' || action === 'secondary')) {
        const side = action === 'primary' ? 0 : 1;
        if (!(remaining[side] > 0)) return;
        const wasRunning = running === side;
        stop(now);
        if (!wasRunning) {
          running = side;
          deadline = now + remaining[side];
        }
      }
    },
    snapshot(now) {
      settle(now);
      return {
        remainingMs: remaining.map((ms, side) => side === running ? deadline - now : ms),
        running,
        paused,
      };
    },
    nextDeadline() {
      return deadline;
    },
  };
}
