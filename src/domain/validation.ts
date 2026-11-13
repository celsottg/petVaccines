import { z } from 'zod';

import type { IsoDate } from './dates';

// Issue messages are stable codes; the screens translate them.
export const isoDate = z
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

const optionalText = z.string().nullish();

export function vaccinationInputSchema(ctx: { today: IsoDate; birthOn: IsoDate | null }) {
  return z
    .object({
      catalogId: optionalText,
      vaccineName: z.string().trim().min(1, 'required'),
      appliedOn: notAfter(ctx.today),
      nextDueOn: isoDate.nullish(),
      batch: optionalText,
      brand: optionalText,
      vetName: optionalText,
      vetLicense: optionalText,
      clinic: optionalText,
      notes: optionalText,
      remindersEnabled: z.boolean().optional(),
    })
    .superRefine((value, issues) => {
      if (ctx.birthOn !== null && value.appliedOn < ctx.birthOn) {
        issues.addIssue({ code: 'custom', path: ['appliedOn'], message: 'before_birth' });
      }
      if (value.nextDueOn && value.nextDueOn <= value.appliedOn) {
        issues.addIssue({ code: 'custom', path: ['nextDueOn'], message: 'next_not_after' });
      }
    });
}
