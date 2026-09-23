/**
 * How a scheduled job reads to a human — in an email, a calendar entry's
 * description, or an admin notification.
 *
 * The feed and the per-job email describe the same logical event (they share a
 * UID), so they have to word it the same way; that is what this module is for.
 */

/** 2026-09-26 -> Saturday, September 26, 2026. Parsed as UTC so the date never slips a day. */
export function formatScheduleDate(date: string): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Postgres hands a `time` column back as 'HH:MM:SS' while the Jobs form sends
 * 'HH:MM'. Anything that compares or stores these has to pick one shape, or an
 * unchanged job looks rescheduled on every save.
 */
export function normalizeScheduleTime(time: string | null | undefined): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time?.trim() ?? '');
  if (!match) return null;
  // Same range check the ICS writer applies, so a value one module calls
  // unreadable is never the one the other happily prints.
  if (Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** 'HH:MM[:SS]' -> '11:30 AM'. Returns null for anything it cannot read. */
export function formatScheduleTime(time: string | null | undefined): string | null {
  const normalized = normalizeScheduleTime(time);
  if (!normalized) return null;

  const [hourText, minuteText] = normalized.split(':');
  const hour = Number(hourText);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minuteText} ${period}`;
}

/**
 * The day on its own for a job scheduled by date, the day plus its hours once a
 * start time exists. An end time only shows when it is actually after the start,
 * matching the range the calendar entry ends up with.
 */
export function formatScheduleWhen(
  date: string,
  startTime?: string | null,
  endTime?: string | null,
): string {
  const prettyDate = formatScheduleDate(date);
  const start = formatScheduleTime(startTime);
  if (!start) return prettyDate;

  const normalizedStart = normalizeScheduleTime(startTime)!;
  const normalizedEnd = normalizeScheduleTime(endTime);
  const end = normalizedEnd && normalizedEnd > normalizedStart ? formatScheduleTime(endTime) : null;

  return `${prettyDate}, ${end ? `${start} – ${end}` : start}`;
}
