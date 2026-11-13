import { useReminderSync } from '@/data/useReminderSync';

/** Renders nothing; keeps the local reminders in step with the data while the app is open. */
export function ReminderSync() {
  useReminderSync();
  return null;
}
