// The header's date filter: an explicit start/end range the user can set on
// both ends, rather than a day-count that always ended at wall-clock "today".
// The platform's own data can lag behind real time (see selectedRange.ts), so
// callers compare against the service's latest scored date, never `new Date()`.

export const DEFAULT_WINDOW_DAYS = 7;

/** Hard ceilings from the live API's own query-parameter validation:
 * /batteries/health/trend's `days` tops out at 30; every per-asset telemetry
 * endpoint (/vehicles, /batteries, /apps, /assets) tops out at 180. Fetches
 * request the largest allowed window so fitToRange always has enough history
 * on hand to slice the user's chosen from/to out of. */
export const MAX_TREND_FETCH_DAYS = 30;
export const MAX_TELEMETRY_FETCH_DAYS = 180;

export const FROM_COOKIE = "range_from";
export const TO_COOKIE = "range_to";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a cookie/query value as a plain YYYY-MM-DD date, else null. */
export function parseDateParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && DATE_RE.test(value) ? value : null;
}

export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Inclusive day count spanned by a from/to pair. */
export function spanDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

/** Every calendar day between from and to inclusive, oldest first, YYYY-MM-DD. */
export function daysInRange(from: string, to: string): string[] {
  return Array.from({ length: spanDays(from, to) }, (_, i) => addDays(from, i));
}

/** One entry per day of the window: the API's own point for that date, or a
 * date-only placeholder (rendered as a gap) when it has none — e.g. the user
 * picked a start date further back than the API's own fetch cap allows. */
export function fitToRange<T extends { date: string }>(
  points: T[],
  from: string,
  to: string,
): (Partial<T> & { date: string })[] {
  const byDay = new Map(points.map((p) => [p.date.slice(0, 10), p]));
  return daysInRange(from, to).map(
    (day) => byDay.get(day) ?? ({ date: `${day}T00:00:00` } as Partial<T> & { date: string }),
  );
}
