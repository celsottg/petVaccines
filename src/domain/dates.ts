/** Calendar date as text, `YYYY-MM-DD`. */
export type IsoDate = string;

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

// Arithmetic runs at 12:00 UTC so daylight saving time never shifts the date.
function toUtcNoon(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

function fromUtc(ms: number): IsoDate {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Today's date on the device clock (local time, not UTC). */
export function todayLocal(now: Date = new Date()): IsoDate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtcNoon(date) + days * DAY_MS);
}

/** Whole days from `b` to `a` (a − b). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcNoon(a) - toUtcNoon(b)) / DAY_MS);
}
