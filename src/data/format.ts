/** Shared formatting helpers for timers and stats. */

/** Format milliseconds as MM:SS.mmm (speed-clock style). */
export function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalMs = Math.floor(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
}

/** Format milliseconds as M:SS (coarse run-time style). */
export function formatDurationShort(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${pad(s, 2)}`;
}

/** Thousands-separated integer. */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function pad(n: number, len: number): string {
  return n.toString().padStart(len, "0");
}
