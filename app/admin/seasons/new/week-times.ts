import { addWeeks, format } from "date-fns";

// `datetime-local` strings ("2026-09-11T19:15") rather than instants, because
// "same time next week" means the same wall-clock time. addWeeks walks the
// local calendar, so a season crossing a daylight-saving boundary keeps its
// 7:15pm slot; adding 168 hours to a timestamp would slide it to 6:15pm.

/**
 * Expands a first match time into `weekCount` weekly slots. The day of the
 * week is whatever `firstMatch` falls on — it isn't configured separately.
 * Returns [] on unparseable input; the caller validates and reports.
 */
export function generateWeekTimes(
  firstMatch: string,
  weekCount: number
): string[] {
  const start = new Date(firstMatch);
  if (Number.isNaN(start.getTime()) || weekCount < 1) {
    return [];
  }

  return Array.from({ length: weekCount }, (_, index) =>
    format(addWeeks(start, index), "yyyy-MM-dd'T'HH:mm")
  );
}
