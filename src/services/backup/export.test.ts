import * as Sharing from 'expo-sharing';
import { zip } from 'react-native-zip-archive';

import { addAttachment } from '@/data/attachments';
import { archivePet, createPet } from '@/data/pets';
import { getSettings, setSetting } from '@/data/settings';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { pets, settings } from '@/db/schema';

import { fakeFs } from '../fakeFileSystem';
import { exportBackup } from './export';
import { backupSchema } from './schema';
import { SHARING_UNAVAILABLE } from '../sharingError';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testDb').createTestDb() }));
jest.mock('expo-file-system', () => jest.requireActual('../fakeFileSystem').fakeModule);
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('react-native-zip-archive', () => ({ zip: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));

const isAvailable = jest.mocked(Sharing.isAvailableAsync);
const share = jest.mocked(Sharing.shareAsync);
const zipMock = jest.mocked(zip);

const STAGING = 'file:///cache/petvaccines-backup-staging';
const TARGET = 'file:///cache/petvaccines-backup-2026-11-13.zip';
const PHOTO = '11111111-1111-4111-8111-111111111111';
const PHOTO2 = '22222222-2222-4222-8222-222222222222';
const PET_PHOTO = '33333333-3333-4333-8333-333333333333';

// 22:30 local is already the 14th in UTC: the zip name must use the local day.
beforeAll(() => jest.useFakeTimers({ now: new Date(2026, 10, 13, 22, 30) }));
afterAll(() => jest.useRealTimers());

let zipped: { tree: string[]; data: string | undefined };

beforeEach(() => {
  jest.clearAllMocks();
  fakeFs.reset();
  fakeFs.addDir('file:///cache');
  fakeFs.addDir('file:///docs/photos');
  fakeFs.addDir('file:///docs/pets');
  db.delete(pets).run();
  db.delete(settings).run();
  isAvailable.mockResolvedValue(true);
  share.mockResolvedValue(undefined);
  zipMock.mockImplementation(async (source, target) => {
    zipped = { tree: fakeFs.tree(source as string), data: fakeFs.text(`${source as string}/data.json`) };
    fakeFs.addFile(target, 4000);
    return target;
  });
});

function populate(options: { missingPhoto?: boolean } = {}) {
  const thor = createPet(db, { name: 'Thor', species: 'dog', photoFile: `${PET_PHOTO}.jpg` });
  const mimi = createPet(db, { name: 'Mimi', species: 'cat' });
  const vaccination = createVaccination(db, { petId: thor.id, vaccineName: 'Antirrábica', appliedOn: '2026-10-02' });
  addAttachment(db, { id: PHOTO, vaccinationId: vaccination.id, file: `${PHOTO}.jpg`, sizeBytes: 1, width: 1, height: 1 });
  addAttachment(db, { id: PHOTO2, vaccinationId: vaccination.id, file: `${PHOTO2}.jpg`, sizeBytes: 1, width: 1, height: 1 });
  archivePet(db, mimi.id, 'other', null);
  fakeFs.addFile(`file:///docs/photos/${PHOTO}.jpg`);
  if (!options.missingPhoto) fakeFs.addFile(`file:///docs/photos/${PHOTO2}.jpg`);
  fakeFs.addFile(`file:///docs/pets/${PET_PHOTO}.jpg`);
  // A file nothing references must never reach the zip.
  fakeFs.addFile('file:///docs/photos/99999999-9999-4999-8999-999999999999.jpg');
}

describe('exportBackup', () => {
  it('zips data.json and the photo files, and opens the share sheet', async () => {
    populate();

    const result = await exportBackup();

    expect(result).toEqual({ missingPhotos: 0 });
    expect(zipped.tree).toEqual(['data.json', `pets/${PET_PHOTO}.jpg`, `photos/${PHOTO}.jpg`, `photos/${PHOTO2}.jpg`]);
    expect(zipMock).toHaveBeenCalledWith(STAGING, TARGET);
    expect(share).toHaveBeenCalledWith(TARGET, expect.objectContaining({ mimeType: 'application/zip' }));
  });

  it('writes a data.json that passes the schema, with the app version and all pets', async () => {
    populate();

    await exportBackup();

    const data = backupSchema.parse(JSON.parse(zipped.data!));
    expect(data).toMatchObject({ format: 'petvaccines-backup', schemaVersion: 1, appVersion: '1.2.3' });
    expect(data.exportedAt).toBe(new Date(2026, 10, 13, 22, 30).toISOString());
    expect(data.pets.map((p) => [p.name, p.status]).sort()).toEqual([['Mimi', 'archived'], ['Thor', 'active']]);
    expect(data.attachments).toHaveLength(2);
  });

  it('stores last_backup_at once the share sheet opened', async () => {
    populate();

    await exportBackup();

    expect(getSettings(db).lastBackupAt).toBe(new Date(2026, 10, 13, 22, 30).toISOString());
  });

  it('does not store last_backup_at when the zip fails, and leaves nothing behind', async () => {
    populate();
    zipMock.mockRejectedValue(new Error('zip failed'));

    await expect(exportBackup()).rejects.toThrow('zip failed');

    expect(getSettings(db).lastBackupAt).toBeNull();
    expect(share).not.toHaveBeenCalled();
    expect(fakeFs.names('file:///cache')).toEqual([]);
    expect(fakeFs.hasDir(STAGING)).toBe(false);
  });

  it('does not store last_backup_at when the share sheet fails, and removes the zip', async () => {
    populate();
    share.mockRejectedValue(new Error('share failed'));

    await expect(exportBackup()).rejects.toThrow('share failed');

    expect(getSettings(db).lastBackupAt).toBeNull();
    expect(fakeFs.has(TARGET)).toBe(false);
    expect(fakeFs.hasDir(STAGING)).toBe(false);
  });

  it('rejects with SHARING_UNAVAILABLE before doing any work', async () => {
    populate();
    isAvailable.mockResolvedValue(false);

    await expect(exportBackup()).rejects.toThrow(SHARING_UNAVAILABLE);

    expect(zipMock).not.toHaveBeenCalled();
    expect(getSettings(db).lastBackupAt).toBeNull();
  });

  it('keeps the zip after sharing, removes the staging folder and clears earlier backups first', async () => {
    populate();
    fakeFs.addFile('file:///cache/petvaccines-backup-2026-10-01.zip');
    fakeFs.addFile('file:///cache/carteira-thor-2026-11-01.pdf');

    await exportBackup();

    expect(fakeFs.names('file:///cache')).toEqual(['carteira-thor-2026-11-01.pdf', 'petvaccines-backup-2026-11-13.zip']);
    expect(fakeFs.hasDir(STAGING)).toBe(false);
  });

  it('is not stopped by an earlier backup that cannot be deleted', async () => {
    populate();
    fakeFs.addFile('file:///cache/petvaccines-backup-2026-10-01.zip', 1, { failDelete: true });

    await expect(exportBackup()).resolves.toEqual({ missingPhotos: 0 });
  });

  it('leaves out a photo that is missing on disk, keeps its rows and reports it', async () => {
    populate({ missingPhoto: true });

    const result = await exportBackup();

    expect(result).toEqual({ missingPhotos: 1 });
    expect(zipped.tree).toEqual(['data.json', `pets/${PET_PHOTO}.jpg`, `photos/${PHOTO}.jpg`]);
    expect(JSON.parse(zipped.data!).attachments).toHaveLength(2);
    expect(getSettings(db).lastBackupAt).not.toBeNull();
  });

  it('counts a photo that cannot be copied as missing too', async () => {
    populate();
    fakeFs.addFile(`file:///docs/photos/${PHOTO}.jpg`, 10, { failCopy: true });

    expect((await exportBackup()).missingPhotos).toBe(1);
  });

  it('exports an empty database', async () => {
    const result = await exportBackup();

    expect(result).toEqual({ missingPhotos: 0 });
    expect(zipped.tree).toEqual(['data.json']);
  });

  it('keeps the existing settings out of the backup but changed preferences in', async () => {
    setSetting(db, 'backup_warning_days', 30);

    await exportBackup();

    expect(JSON.parse(zipped.data!).settings.backup_warning_days).toBe(30);
  });
});
