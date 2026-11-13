import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { createPet } from '@/data/pets';
import { createVaccination } from '@/data/vaccinations';
import { setSetting } from '@/data/settings';
import { db } from '@/db/client';
import { pets, settings, vaccinations } from '@/db/schema';

import { ensureNotificationPermission, getNotificationPermission, reminderFireDate, requestReminderSync, syncReminders } from './reminders';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testDb').createTestDb() }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const n = jest.mocked(Notifications);
const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' } as never;
const denied = { status: 'denied', granted: false, canAskAgain: false, expires: 'never' } as never;
const undetermined = { status: 'undetermined', granted: false, canAskAgain: true, expires: 'never' } as never;

// 2026-11-12 08:00 local (UTC-3 in the test environment): before that day's 09:00.
const MORNING = new Date(2026, 10, 12, 8, 0, 0);

function addPet(name = 'Thor', status: 'active' | 'archived' = 'active') {
  const pet = createPet(db, { name, species: 'dog' });
  if (status === 'archived') db.update(pets).set({ status: 'archived' }).run();
  return pet;
}

const bodies = () => n.scheduleNotificationAsync.mock.calls.map(([request]) => request.content.body);
const triggerDates = () =>
  n.scheduleNotificationAsync.mock.calls.map(([request]) => (request.trigger as { date: Date }).date);

describe('reminderFireDate', () => {
  it('is 09:00 local on the calendar date, not a UTC instant', () => {
    const date = reminderFireDate('2026-12-02');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([
      2026, 11, 2, 9, 0, 0,
    ]);
    // 09:00 in UTC-3 is 12:00 UTC: the day must not move.
    expect(date.toISOString()).toBe('2026-12-02T12:00:00.000Z');
  });
});

describe('syncReminders', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: MORNING, doNotFake: ['setImmediate', 'nextTick'] });
    jest.resetAllMocks();
    db.delete(pets).run();
    db.delete(settings).run();
    n.getPermissionsAsync.mockResolvedValue(granted);
    n.requestPermissionsAsync.mockResolvedValue(granted);
    n.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
    n.scheduleNotificationAsync.mockResolvedValue('id');
    n.setNotificationChannelAsync.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('cancels everything and schedules one notification per reminder, at 09:00 local, with the spec texts', async () => {
    const pet = addPet('Thor');
    createVaccination(db, { petId: pet.id, vaccineName: 'Antirrábica', appliedOn: '2025-12-02', nextDueOn: '2026-12-02' });

    await syncReminders();

    expect(n.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(bodies()).toEqual(['Thor: Antirrábica vence em 7 dias', 'Thor: Antirrábica vence hoje']);
    expect(triggerDates().map((d) => d.toISOString())).toEqual(['2026-11-25T12:00:00.000Z', '2026-12-02T12:00:00.000Z']);
    const [first] = n.scheduleNotificationAsync.mock.calls[0];
    expect(first.trigger).toMatchObject({ type: 'date', channelId: 'reminders' });
    expect(n.cancelAllScheduledNotificationsAsync.mock.invocationCallOrder[0]).toBeLessThan(
      n.scheduleNotificationAsync.mock.invocationCallOrder[0],
    );
  });

  it('uses the singular for 1 day and follows the configured offsets', async () => {
    setSetting(db, 'reminder_offsets_days', [1]);
    const pet = addPet('Mel');
    createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2025-12-02', nextDueOn: '2026-12-02' });

    await syncReminders();

    expect(bodies()).toEqual(['Mel: V10 vence em 1 dia']);
    expect(triggerDates().map((d) => d.toISOString())).toEqual(['2026-12-01T12:00:00.000Z']);
  });

  it('does not schedule reminders of an archived pet, a disabled record or a record without next dose', async () => {
    const archived = addPet('Velho', 'archived');
    createVaccination(db, { petId: archived.id, vaccineName: 'A', appliedOn: '2025-12-02', nextDueOn: '2026-12-02' });
    const active = createPet(db, { name: 'Thor', species: 'dog' });
    createVaccination(db, { petId: active.id, vaccineName: 'B', appliedOn: '2025-12-02', nextDueOn: '2026-12-02', remindersEnabled: false });
    createVaccination(db, { petId: active.id, vaccineName: 'C', appliedOn: '2025-12-02' });

    await syncReminders();

    expect(n.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules a reminder due today when 09:00 is still ahead', async () => {
    const pet = addPet();
    createVaccination(db, { petId: pet.id, vaccineName: 'Antirrábica', appliedOn: '2025-11-12', nextDueOn: '2026-11-12' });

    await syncReminders();

    expect(bodies()).toEqual(['Thor: Antirrábica vence hoje']);
  });

  it('skips a reminder whose 09:00 has already passed today, without firing it right away', async () => {
    jest.setSystemTime(new Date(2026, 10, 12, 9, 30, 0));
    const pet = addPet();
    createVaccination(db, { petId: pet.id, vaccineName: 'Antirrábica', appliedOn: '2025-11-12', nextDueOn: '2026-11-12' });
    createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2025-11-13', nextDueOn: '2026-11-13' });

    await syncReminders();

    expect(bodies()).toEqual(['Thor: V10 vence hoje']);
    expect(triggerDates().every((d) => d.getTime() > Date.now())).toBe(true);
  });

  it('also skips at exactly 09:00, when the fire instant is not in the future', async () => {
    jest.setSystemTime(new Date(2026, 10, 12, 9, 0, 0));
    const pet = addPet();
    createVaccination(db, { petId: pet.id, vaccineName: 'Antirrábica', appliedOn: '2025-11-12', nextDueOn: '2026-11-12' });

    await syncReminders();

    expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('keeps the 50 nearest reminders even when today already passed 09:00', async () => {
    jest.setSystemTime(new Date(2026, 10, 12, 10, 0, 0));
    const pet = addPet();
    for (let i = 0; i < 60; i++) {
      const due = new Date(Date.UTC(2026, 10, 12 + i, 12)).toISOString().slice(0, 10);
      createVaccination(db, { petId: pet.id, vaccineName: `Vacina ${String(i).padStart(2, '0')}`, appliedOn: '2025-11-01', nextDueOn: due });
    }
    setSetting(db, 'reminder_offsets_days', [0]);

    await syncReminders();

    expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(50);
    // Today's reminder passed 09:00, so the window starts tomorrow and still holds 50.
    expect(bodies()[0]).toBe('Thor: Vacina 01 vence hoje');
  });

  it('schedules nothing and does not throw when the permission is denied', async () => {
    n.getPermissionsAsync.mockResolvedValue(denied);
    const pet = addPet();
    createVaccination(db, { petId: pet.id, vaccineName: 'Antirrábica', appliedOn: '2025-12-02', nextDueOn: '2026-12-02' });

    await expect(syncReminders()).resolves.toBeUndefined();

    expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(n.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('keeps scheduling the other items when one schedule call fails', async () => {
    const pet = addPet();
    createVaccination(db, { petId: pet.id, vaccineName: 'Antirrábica', appliedOn: '2025-12-02', nextDueOn: '2026-12-02' });
    n.scheduleNotificationAsync.mockRejectedValueOnce(new Error('native failure'));

    await expect(syncReminders()).resolves.toBeUndefined();

    expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['cancel', () => n.cancelAllScheduledNotificationsAsync.mockRejectedValue(new Error('x'))],
    ['permission read', () => n.getPermissionsAsync.mockRejectedValue(new Error('x'))],
    ['channel', () => n.setNotificationChannelAsync.mockRejectedValue(new Error('x'))],
    ['handler', () => n.setNotificationHandler.mockImplementation(() => { throw new Error('x'); })],
  ])('never throws when the %s step fails', async (_name, breakIt) => {
    breakIt();
    await expect(syncReminders()).resolves.toBeUndefined();
  });

  it('never throws when the database cannot be read', async () => {
    jest.spyOn(db, 'select').mockImplementation(() => {
      throw new Error('db closed');
    });
    await expect(syncReminders()).resolves.toBeUndefined();
  });

  it('creates the Android channel, with a pt-BR name, and not on iOS', async () => {
    await syncReminders();
    expect(n.setNotificationChannelAsync).not.toHaveBeenCalled();

    jest.replaceProperty(Platform, 'OS', 'android');
    await syncReminders();
    expect(n.setNotificationChannelAsync).toHaveBeenCalledWith('reminders', {
      name: 'Lembretes de vacina',
      importance: 3,
    });
  });

  it('serializes overlapping requests so cancel and schedule steps never interleave, and the last state wins', async () => {
    const pet = addPet();
    createVaccination(db, { petId: pet.id, vaccineName: 'Antirrábica', appliedOn: '2025-12-02', nextDueOn: '2026-12-02' });
    const events: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    n.cancelAllScheduledNotificationsAsync.mockImplementation(async () => {
      events.push('cancel');
      if (events.filter((e) => e === 'cancel').length === 1) await gate;
    });
    n.scheduleNotificationAsync.mockImplementation(async (request) => {
      events.push(`schedule ${request.content.body}`);
      return 'id';
    });

    const first = requestReminderSync();
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    // The tutor edits the record while the first run waits.
    db.update(vaccinations).set({ nextDueOn: '2026-12-09' }).run();
    const second = requestReminderSync();
    const third = requestReminderSync();
    release();
    await Promise.all([first, second, third]);

    expect(events).toEqual([
      'cancel',
      'schedule Thor: Antirrábica vence em 7 dias',
      'schedule Thor: Antirrábica vence hoje',
      'cancel',
      'schedule Thor: Antirrábica vence em 7 dias',
      'schedule Thor: Antirrábica vence hoje',
    ]);
    expect(triggerDates().slice(-1)[0].toISOString()).toBe('2026-12-09T12:00:00.000Z');
  });
});

describe('ensureNotificationPermission', () => {
  afterEach(() => jest.restoreAllMocks());

  beforeEach(() => {
    jest.resetAllMocks();
    n.requestPermissionsAsync.mockResolvedValue(granted);
    n.setNotificationChannelAsync.mockResolvedValue(null);
    n.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
    n.scheduleNotificationAsync.mockResolvedValue('id');
  });

  it('asks the first time and reports the answer', async () => {
    n.getPermissionsAsync.mockResolvedValue(undetermined);

    await expect(ensureNotificationPermission()).resolves.toBe(true);

    expect(n.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('reports false when the user refuses', async () => {
    n.getPermissionsAsync.mockResolvedValue(undetermined);
    n.requestPermissionsAsync.mockResolvedValue(denied);

    await expect(ensureNotificationPermission()).resolves.toBe(false);
  });

  it('does not ask again once the user answered', async () => {
    n.getPermissionsAsync.mockResolvedValue(denied);
    await expect(ensureNotificationPermission()).resolves.toBe(false);

    n.getPermissionsAsync.mockResolvedValue(granted);
    await expect(ensureNotificationPermission()).resolves.toBe(true);

    expect(n.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('never throws', async () => {
    n.getPermissionsAsync.mockResolvedValue(undetermined);
    n.requestPermissionsAsync.mockRejectedValue(new Error('x'));
    await expect(ensureNotificationPermission()).resolves.toBe(false);
  });

  it('creates the Android channel before asking, which Android 13 needs for the prompt', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    n.getPermissionsAsync.mockResolvedValue(undetermined);

    await ensureNotificationPermission();

    expect(n.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      n.requestPermissionsAsync.mock.invocationCallOrder[0],
    );
  });

  it('schedules the reminders right after the permission is newly granted', async () => {
    n.getPermissionsAsync.mockResolvedValueOnce(undetermined).mockResolvedValue(granted);

    await ensureNotificationPermission();
    await new Promise((resolve) => setImmediate(resolve));

    expect(n.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });
});

describe('getNotificationPermission', () => {
  it.each([
    [granted, 'granted'],
    [denied, 'denied'],
    [undetermined, 'undetermined'],
  ])('maps the system answer to %#', async (answer, expected) => {
    n.getPermissionsAsync.mockResolvedValue(answer);
    await expect(getNotificationPermission()).resolves.toBe(expected);
  });

  it('falls back to undetermined when the system cannot be read', async () => {
    n.getPermissionsAsync.mockRejectedValue(new Error('x'));
    await expect(getNotificationPermission()).resolves.toBe('undetermined');
  });
});
