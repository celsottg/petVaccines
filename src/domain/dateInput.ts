import type { IsoDate } from './dates';

/** Keeps the digits (at most 8) and inserts the slashes of DD/MM/YYYY while typing. */
export function maskBrDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Parses a complete DD/MM/YYYY into an ISO date; null when malformed or not a real calendar date. */
export function parseBrDate(text: string): IsoDate | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const [, d, m, y] = match;
  const probe = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12));
  const real =
    probe.getUTCFullYear() === Number(y) && probe.getUTCMonth() === Number(m) - 1 && probe.getUTCDate() === Number(d);
  return real ? `${y}-${m}-${d}` : null;
}

export function formatBrDate(date: IsoDate): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/** For optional date fields: blank means "no date"; anything else must be a complete, real date. */
export function parseOptionalBrDate(text: string): { ok: true; value: IsoDate | null } | { ok: false } {
  if (text.trim() === '') return { ok: true, value: null };
  const value = parseBrDate(text.trim());
  return value === null ? { ok: false } : { ok: true, value };
}
