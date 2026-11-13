import { splitCurrent, type CatalogMatcher } from './current';
import { addDays, todayLocal, type IsoDate } from './dates';

const FIRE_HOUR = 9;

/** The instant a reminder fires: 09:00 local time on the calendar date (never parsed as UTC). */
export function reminderFireDate(fireOn: IsoDate): Date {
  const [year, month, day] = fireOn.split('-').map(Number);
  return new Date(year, month - 1, day, FIRE_HOUR, 0, 0, 0);
}

/**
 * The first day a reminder can still fire on: today while 09:00 is ahead, otherwise tomorrow.
 * The planner's `today` for both the scheduler and the screens, so they agree on what is listed.
 */
export function earliestReminderDay(now: Date = new Date()): IsoDate {
  const today = todayLocal(now);
  return now.getTime() < reminderFireDate(today).getTime() ? today : addDays(today, 1);
}

// Structural subsets of the data layer's `Pet` and `Vaccination`, so the domain stays free of the data layer.
interface ReminderPet {
  id: string;
  name: string;
  species: 'dog' | 'cat';
  status: 'active' | 'archived';
}

interface ReminderVaccination {
  id: string;
  petId: string;
  catalogId: string | null;
  vaccineName: string;
  appliedOn: IsoDate;
  nextDueOn: IsoDate | null;
  remindersEnabled: boolean;
  createdAt: string;
}

export type PlannedReminder = {
  vaccinationId: string;
  petName: string;
  vaccineName: string;
  fireOn: IsoDate;
  daysBefore: number;
};

export interface PlanRemindersInput {
  pets: ReminderPet[];
  vaccinations: ReminderVaccination[];
  /** Days before the due date, one reminder each. Repeated values count once. */
  offsetsDays: number[];
  /** The earliest date a reminder may fire on (inclusive); the time-of-day cut-off belongs to the caller. */
  today: IsoDate;
  limit: number;
  matcherFor: (species: 'dog' | 'cat') => CatalogMatcher;
}

/**
 * The reminders to schedule: one per offset for each current record of an active
 * pet that has a next dose and reminders enabled, skipping the ones that would
 * fire before `today`. Returns the `limit` nearest, in ascending order of date.
 */
export function planReminders({ pets, vaccinations, offsetsDays, today, limit, matcherFor }: PlanRemindersInput): PlannedReminder[] {
  const offsets = [...new Set(offsetsDays)];
  const planned: PlannedReminder[] = [];

  for (const pet of pets) {
    if (pet.status !== 'active') continue;
    const own = vaccinations.filter((v) => v.petId === pet.id);
    const { current } = splitCurrent(own, matcherFor(pet.species));
    for (const vaccination of current) {
      if (!vaccination.remindersEnabled || vaccination.nextDueOn === null) continue;
      for (const daysBefore of offsets) {
        const fireOn = addDays(vaccination.nextDueOn, -daysBefore);
        if (fireOn < today) continue;
        planned.push({
          vaccinationId: vaccination.id,
          petName: pet.name,
          vaccineName: vaccination.vaccineName,
          fireOn,
          daysBefore,
        });
      }
    }
  }

  // ISO dates compare chronologically as text. Ties keep a stable, readable order.
  planned.sort(
    (a, b) =>
      a.fireOn.localeCompare(b.fireOn) ||
      a.petName.localeCompare(b.petName, 'pt-BR') ||
      a.vaccineName.localeCompare(b.vaccineName, 'pt-BR') ||
      b.daysBefore - a.daysBefore,
  );
  return planned.slice(0, limit);
}
