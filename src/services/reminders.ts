import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus, PermissionStatus, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';

import { catalogMatcher } from '@/catalog';
import { getSettings } from '@/data/settings';
import { db } from '@/db/client';
import { pets, vaccinations } from '@/db/schema';
import { earliestReminderDay, planReminders, reminderFireDate, type PlannedReminder } from '@/domain/reminders';
import { t } from '@/i18n';

import { createSerialRunner } from './serialRunner';

const CHANNEL_ID = 'reminders';
/** iOS keeps at most 64 scheduled local notifications; stay well under it. */
const MAX_SCHEDULED = 50;

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export { reminderFireDate };

function isGranted(answer: Notifications.NotificationPermissionsStatus): boolean {
  return answer.granted || answer.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

// Android 13 only shows the permission prompt once a channel exists, so this runs before asking too.
async function prepare(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('reminders.channel.name'),
      importance: AndroidImportance.DEFAULT,
    });
  }
}

/** What the system currently allows. Never throws; when it cannot be read the answer is `undetermined`. */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  try {
    const answer = await Notifications.getPermissionsAsync();
    if (isGranted(answer)) return 'granted';
    return answer.status === PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

/**
 * Asks for the notification permission only if the user was never asked. An
 * earlier answer, either way, is respected and not asked again. When the
 * permission is newly granted the reminders are scheduled right away. Never throws.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await getNotificationPermission();
    if (current !== 'undetermined') return current === 'granted';
    await prepare();
    const answer = await Notifications.requestPermissionsAsync();
    const allowed = isGranted(answer);
    if (allowed) void requestReminderSync();
    return allowed;
  } catch {
    return false;
  }
}

function reminderBody(reminder: PlannedReminder): string {
  const params = { pet: reminder.petName, vaccine: reminder.vaccineName };
  return reminder.daysBefore === 0
    ? t('reminders.notification.today', params)
    : t('reminders.notification.inDays', { ...params, count: reminder.daysBefore });
}

/**
 * Makes the scheduled notifications match the data: cancels every notification
 * the app scheduled, then schedules the nearest reminders (up to 50). Never
 * throws; a failure leaves whatever could not be done for the next run.
 */
export async function syncReminders(): Promise<void> {
  try {
    await prepare();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if ((await getNotificationPermission()) !== 'granted') return;

    // Past today's 09:00 the first possible day is tomorrow; deciding it before planning keeps the 50-item window full.
    const planned = planReminders({
      pets: db.select().from(pets).all(),
      vaccinations: db.select().from(vaccinations).all(),
      offsetsDays: getSettings(db).reminderOffsetsDays,
      today: earliestReminderDay(),
      limit: MAX_SCHEDULED,
      matcherFor: catalogMatcher,
    });

    for (const reminder of planned) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: t('reminders.notification.title'),
            body: reminderBody(reminder),
            data: { vaccinationId: reminder.vaccinationId },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: reminderFireDate(reminder.fireOn),
            channelId: CHANNEL_ID,
          },
        });
      } catch {
        // One failing item must not stop the others; the next run tries again.
      }
    }
  } catch {
    // Reminders are a convenience: the app keeps working and the next run retries.
  }
}

/** The single entry point for reconciling reminders: runs never overlap and the last request wins. */
export const requestReminderSync = createSerialRunner(syncReminders);
