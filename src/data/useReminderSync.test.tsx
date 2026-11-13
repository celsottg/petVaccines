import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { createPet } from '@/data/pets';
import { setSetting } from '@/data/settings';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { pets, settings } from '@/db/schema';
import { requestReminderSync } from '@/services/reminders';

import { useReminderSync } from './useReminderSync';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));
jest.mock('@/services/reminders', () => ({ requestReminderSync: jest.fn().mockResolvedValue(undefined) }));

function Probe() {
  useReminderSync();
  return null;
}

describe('useReminderSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.delete(pets).run();
    db.delete(settings).run();
  });

  it('requests a sync at start', async () => {
    await render(<Probe />);

    expect(requestReminderSync).toHaveBeenCalled();
  });

  it('requests another sync when a pet, a vaccination or a setting changes', async () => {
    await render(<Probe />);
    const atStart = jest.mocked(requestReminderSync).mock.calls.length;

    let pet!: ReturnType<typeof createPet>;
    await act(async () => {
      pet = createPet(db, { name: 'Thor', species: 'dog' });
    });
    const afterPet = jest.mocked(requestReminderSync).mock.calls.length;
    expect(afterPet).toBeGreaterThan(atStart);

    await act(async () => {
      createVaccination(db, { petId: pet.id, vaccineName: 'Antirrábica', appliedOn: '2026-11-01', nextDueOn: '2027-11-01' });
    });
    const afterVaccination = jest.mocked(requestReminderSync).mock.calls.length;
    expect(afterVaccination).toBeGreaterThan(afterPet);

    await act(async () => {
      db.transaction((tx) => setSetting(tx, 'reminder_offsets_days', [3]));
    });
    expect(jest.mocked(requestReminderSync).mock.calls.length).toBeGreaterThan(afterVaccination);
  });

  describe('returning to the foreground', () => {
    let emit: (state: AppStateStatus) => void;
    const remove = jest.fn();

    beforeEach(() => {
      remove.mockClear();
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
        emit = listener;
        return { remove };
      });
    });

    afterEach(() => jest.restoreAllMocks());

    it('requests a sync when the app becomes active again, and only then', async () => {
      await render(<Probe />);
      const before = jest.mocked(requestReminderSync).mock.calls.length;

      await act(async () => emit('background'));
      await act(async () => emit('inactive'));
      expect(jest.mocked(requestReminderSync).mock.calls.length).toBe(before);

      await act(async () => emit('active'));
      expect(jest.mocked(requestReminderSync).mock.calls.length).toBe(before + 1);
    });

    it('stops listening when it unmounts', async () => {
      const view = await render(<Probe />);
      await view.unmount();
      expect(remove).toHaveBeenCalledTimes(1);
    });
  });
});
