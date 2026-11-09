export const staleAfterMs = 3000;

export function displayTime({ snapshot, receivedAt, offset }, now) {
  const stale = now - receivedAt >= staleAfterMs;
  const elapsed = Math.max(0, Math.min(now, receivedAt + staleAfterMs) + offset - snapshot.sampledAt);
  const remainingMs = snapshot.remainingMs.map((ms, side) => side === snapshot.running ? Math.max(0, ms - elapsed) : ms);
  return {
    stale,
    remainingMs,
  };
}
