import { cookies } from "next/headers";
import { DAYS_COOKIE, parseDays } from "./dateRange";

/** The header's date range for this request — the picker's saved choice, or
 * the 7-day default. One source, so the header and every chart always agree. */
export async function selectedDays(): Promise<number> {
  return parseDays((await cookies()).get(DAYS_COOKIE)?.value);
}
