/**
 * Dates for the demo's set dressing.
 *
 * These used to be literals — "Wednesday, September 16", "Sept 16 2026" —
 * which look right on the day they are written and are quietly wrong every
 * day after. The status line is the first thing under the greeting on /home,
 * so a stale date there is the detail a prospect notices while you are
 * talking about something else.
 *
 * EVERY VALUE IS COMPUTED ON THE SERVER and passed down as a finished string,
 * the same way the greeting is. A `new Date()` inside a client component
 * renders one value during SSR and another in the browser, which React
 * reports as a hydration mismatch.
 *
 * The times are still fixed: "02:14 UTC" is plausible on any day and reads as
 * an overnight batch window. Only the dates move.
 */

/** "Wednesday, September 23" — the status line under the greeting. */
export function statusDate(now: Date): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Days until month end, which is what "close" means to this audience.
 *  0 on the last day of the month. */
export function daysToClose(now: Date): number {
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).setHours(0, 0, 0, 0);
  const today = new Date(now).setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((endOfMonth - today) / 86_400_000));
}

/** "close in 7 days", degrading sensibly as the month runs out. */
export function closePhrase(now: Date): string {
  const days = daysToClose(now);
  if (days === 0) return "close today";
  if (days === 1) return "close tomorrow";
  return `close in ${days} days`;
}

/** "02:14 UTC · Sep 23 2026" — the overnight extract stamp on /analytics. */
export function extractStamp(now: Date): string {
  const date = now
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .replace(",", "");
  return `02:14 UTC · ${date}`;
}
