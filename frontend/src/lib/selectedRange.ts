import { cookies } from "next/headers";
import { DEFAULT_WINDOW_DAYS, FROM_COOKIE, TO_COOKIE, addDays, parseDateParam } from "./dateRange";

export interface SelectedRange {
  from: string;
  to: string;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The header's saved date range for this request — one source, so the header
 * and every chart always agree.
 *
 * `latestDataDate` is the platform's own latest scored day (the command
 * centre's freshest alert timestamp). The service can run a day or more
 * behind wall-clock time, so `to` is clamped to that date rather than to
 * `new Date()` — otherwise a saved or default "today" would land on a day the
 * data hasn't reached yet and the window would render empty.
 */
export async function selectedRange(latestDataDate: string | null): Promise<SelectedRange> {
  const jar = await cookies();
  const ceiling = latestDataDate ?? todayUtc();

  let to = parseDateParam(jar.get(TO_COOKIE)?.value) ?? ceiling;
  if (to > ceiling) to = ceiling;

  let from = parseDateParam(jar.get(FROM_COOKIE)?.value) ?? addDays(to, -(DEFAULT_WINDOW_DAYS - 1));
  if (from > to) from = to;

  return { from, to };
}
