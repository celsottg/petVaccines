export const DUE_SOON_RANGE = { min: 1, max: 365 } as const;
export const OFFSET_RANGE = { min: 0, max: 365 } as const;

export interface SettingsInput {
  dueSoonDays: string;
  offsets: string[];
}

export interface SettingsErrors {
  dueSoonDays?: 'dueSoonInvalid';
  /** One entry per offset, in input order; undefined when that offset is fine. */
  offsets: ('offsetInvalid' | 'offsetDuplicate' | undefined)[];
  offsetsRequired?: true;
}

export type SettingsResult =
  | { ok: true; value: { dueSoonDays: number; reminderOffsetsDays: number[] } }
  | { ok: false; errors: SettingsErrors };

/** A whole number written with digits only, within the range; otherwise undefined. */
function parseWhole(text: string, range: { min: number; max: number }): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value >= range.min && value <= range.max ? value : undefined;
}

/** Validates the settings form. Offsets are returned from the farthest to the day itself. */
export function validateSettingsInput(input: SettingsInput): SettingsResult {
  const dueSoonDays = parseWhole(input.dueSoonDays, DUE_SOON_RANGE);
  const seen = new Set<number>();
  const parsed: number[] = [];
  const offsetErrors = input.offsets.map((text) => {
    const value = parseWhole(text, OFFSET_RANGE);
    if (value === undefined) return 'offsetInvalid' as const;
    if (seen.has(value)) return 'offsetDuplicate' as const;
    seen.add(value);
    parsed.push(value);
    return undefined;
  });

  const errors: SettingsErrors = { offsets: offsetErrors };
  if (dueSoonDays === undefined) errors.dueSoonDays = 'dueSoonInvalid';
  if (input.offsets.length === 0) errors.offsetsRequired = true;
  const failed = errors.dueSoonDays || errors.offsetsRequired || offsetErrors.some(Boolean);
  if (failed || dueSoonDays === undefined) return { ok: false, errors };
  return { ok: true, value: { dueSoonDays, reminderOffsetsDays: parsed.sort((a, b) => b - a) } };
}

export const BACKUP_WARNING_RANGE = { min: 1, max: 365 } as const;

/** The backup warning period typed by the tutor: a whole number of days within the range, or undefined. */
export function parseBackupWarningDays(text: string): number | undefined {
  return parseWhole(text, BACKUP_WARNING_RANGE);
}
