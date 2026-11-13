import { addDays, type IsoDate } from './dates';

/** Suggested next dose: the application date plus the catalog booster interval. */
export function suggestNextDue(appliedOn: IsoDate, boosterIntervalDays: number): IsoDate {
  return addDays(appliedOn, boosterIntervalDays);
}
