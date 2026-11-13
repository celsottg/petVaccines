import { z } from 'zod';

import type { IsoDate } from './dates';

// Issue messages are stable codes; the screens translate them.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d, 12));
    return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
  }, 'invalid_date');

// ISO dates compare chronologically as text.
const notAfter = (today: IsoDate) => isoDate.refine((s) => s <= today, 'future_date');

export function petInputSchema(today: IsoDate) {
  return z.object({
    name: z.string().trim().min(1, 'required'),
    species: z.enum(['dog', 'cat']),
    breed: z.string().nullish(),
    sex: z.enum(['male', 'female']).nullish(),
    birthOn: notAfter(today).nullish(),
    photoFile: z.string().nullish(),
  });
}

export function archiveInputSchema(today: IsoDate) {
  return z.object({
    reason: z.enum(['deceased', 'rehomed', 'other']),
    on: notAfter(today).nullable(),
  });
}
