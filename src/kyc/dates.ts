// Calendar dates are plain "YYYY-MM-DD" strings in Asia/Dubai time 
// Working on date-only strings means no hour or time-zone can shift a day.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Day number since 1970-01-01, or null when the text is not a real date (e.g. 2026-02-30).
function dayNumber(isoDate: string): number | null {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  const utc = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(utc);
  if (roundTrip.getUTCMonth() !== month - 1 || roundTrip.getUTCDate() !== day) return null;
  return utc / MS_PER_DAY;
}

export function isIsoDate(text: string): boolean {
  return dayNumber(text) !== null;
}

// Whole days from `from` to `to`: positive when `to` is later. Null if either is not a date.
export function daysBetween(from: string, to: string): number | null {
  const start = dayNumber(from);
  const end = dayNumber(to);
  return start === null || end === null ? null : end - start;
}


export function todayInDubai(now: Date): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(now);
}
