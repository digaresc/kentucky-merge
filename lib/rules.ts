export const rules = () => ({
  title: process.env.EVENT_TITLE || "KENTUCKY MERGE",
  ticker: process.env.TICKER_MESSAGE || null,
  trackLength: Math.max(3, Number(process.env.TRACK_LENGTH) || 10),
  // Hosts and bots that shouldn't appear on the leaderboard.
  excluded: new Set(
    (process.env.EXCLUDE_LOGINS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ),
});

export const raceMinutes = () => Math.max(1, Number(process.env.EVENT_MINUTES) || 80);

export function eventWindow(startOverride?: string | null): { start: Date | null; end: Date | null } {
  const raw = startOverride || process.env.EVENT_START;
  const start = raw ? new Date(raw) : null;
  if (!start || Number.isNaN(start.getTime())) return { start: null, end: null };
  return { start, end: new Date(start.getTime() + raceMinutes() * 60_000) };
}
