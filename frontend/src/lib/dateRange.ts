// The header's date filter: a window of `days` ending today (?days=, default 7).
// The API serves history as "the last N days of data", which can end before
// today, so charts fetch N days and are then laid out against the real
// calendar — days the API has no data for stay empty rather than being filled.

export const DEFAULT_DAYS = 7;
const FLEET_TIME_ZONE = "Asia/Kolkata";

export function parseDays(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(value) && value >= 1 ? Math.min(365, Math.round(value)) : DEFAULT_DAYS;
}

function ymd(date: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return date.toLocaleDateString("en-CA", { timeZone: FLEET_TIME_ZONE });
}

/** Every calendar day in the window, oldest first, as YYYY-MM-DD. */
export function rangeDays(days: number, today: Date = new Date()): string[] {
  const end = new Date(`${ymd(today)}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

/** One entry per day of the window: the API's own point for that date, or a
 * date-only placeholder (rendered as a gap) when it has none. */
export function fitToRange<T extends { date: string }>(
  points: T[],
  days: number,
): (Partial<T> & { date: string })[] {
  const byDay = new Map(points.map((p) => [p.date.slice(0, 10), p]));
  return rangeDays(days).map((day) => byDay.get(day) ?? ({ date: `${day}T00:00:00` } as Partial<T> & { date: string }));
}

/** The picker also stores its choice here, so the range carries across pages
 * instead of resetting whenever a link drops the ?days= parameter. */
export const DAYS_COOKIE = "range_days";
