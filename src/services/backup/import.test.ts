import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { unzip } from 'react-native-zip-archive';

import { addAttachment } from '@/data/attachments';
import { createPet } from '@/data/pets';
import { getSettings, setSetting } from '@/data/settings';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { attachments, pets, settings, vaccinations } from '@/db/schema';
import * as files from '../files';

import { fakeFs } from '../fakeFileSystem';
import { sampleBackup } from './fixture';
import { MAX_DATA_JSON_BYTES, applyBackup, discardBackupPreview, pickAndReadBackup, readBackup, type BackupPreview } from './import';
import type { BackupData } from './schema';
import { BackupError } from './validate';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testDb').createTestDb() }));
jest.mock('expo-file-system', () => jest.requireActual('../fakeFileSystem').fakeModule);
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('react-native-zip-archive', () => ({ unzip: jest.fn() }));

const unzipMock = jest.mocked(unzip);
const pickerMock = jest.mocked(DocumentPicker.getDocumentAsync);

const PARENT = 'file:///cache/petvaccines-import';
const ZIP = 'file:///cache/picked.zip';
const PET_PHOTO = '33333333-3333-4333-8333-333333333333.jpg';
const PROOF = '44444444-4444-4444-8444-444444444444.jpg';
const OLD_PHOTO = '99999999-9999-4999-8999-999999999999.jpg';

/** Every column of the four tables and the names in both photo folders: what "nothing changed" means. */
function snapshot() {
  return {
    pets: db.select().from(pets).all().sort((a, b) => a.id.localeCompare(b.id)),
    vaccinations: db.select().from(vaccinations).all().sort((a, b) => a.id.localeCompare(b.id)),
    attachments: db.select().from(attachments).all().sort((a, b) => a.id.localeCompare(b.id)),
    settings: db.select().from(settings).all().sort((a, b) => a.key.localeCompare(b.key)),
    photos: fakeFs.tree('file:///docs/photos').map((name) => `${name}:${fakeFs.size(`file:///docs/photos/${name}`)}`),
    petPhotos: fakeFs.tree('file:///docs/pets').map((name) => `${name}:${fakeFs.size(`file:///docs/pets/${name}`)}`),
  };
}
const stagingGone = () => expect(fakeFs.dirsUnder(PARENT)).toEqual([]);

/** What the fake `unzip` puts in the staging folder: path inside the zip -> text (or size for a photo). */
let zipContent: Record<string, string | number>;
let unzipFailure: unknown;

function validZip(data: BackupData = sampleBackup()): Record<string, string | number> {
  return { 'data.json': JSON.stringify(data), [`pets/${PET_PHOTO}`]: 10, [`photos/${PROOF}`]: 10 };
}

beforeAll(() => jest.useFakeTimers({ now: new Date(2026, 10, 13, 10), doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'queueMicrotask'] }));
afterAll(() => jest.useRealTimers());
afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  jest.clearAllMocks();
  fakeFs.reset();
  fakeFs.addDir('file:///cache');
  fakeFs.addFile(ZIP, 5000);
  db.delete(pets).run();
  db.delete(settings).run();
  unzipFailure = undefined;
  zipContent = validZip();
  unzipMock.mockImplementation(async (_source, target) => {
    if (unzipFailure) throw unzipFailure;
    fakeFs.addDir(target);
    for (const [path, content] of Object.entries(zipContent)) {
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i += 1) fakeFs.addDir(`${target}/${parts.slice(0, i).join('/')}`);
      if (typeof content === 'string') fakeFs.addFile(`${target}/${path}`, content.length, { text: content });
      else fakeFs.addFile(`${target}/${path}`, content);
    }
    return target;
  });
});

const codeOfFailure = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (failure) {
    expect(failure).toBeInstanceOf(BackupError);
    return (failure as BackupError).code;
  }
  return undefined;
};

function oldDevice() {
  const pet = createPet(db, { name: 'Old', species: 'dog', photoFile: OLD_PHOTO });
  const archived = createPet(db, { name: 'Older', species: 'cat' });
  const v = createVaccination(db, { petId: pet.id, vaccineName: 'Old vaccine', appliedOn: '2026-01-01', notes: 'n' });
  createVaccination(db, { petId: archived.id, vaccineName: 'Other', appliedOn: '2026-02-01' });
  const oldProof = '88888888-8888-4888-8888-888888888881.jpg';
  addAttachment(db, { id: oldProof.slice(0, -4), vaccinationId: v.id, file: oldProof, sizeBytes: 1, width: 1, height: 1 });
  fakeFs.addFile(`file:///docs/pets/${OLD_PHOTO}`, 11);
  fakeFs.addFile(`file:///docs/photos/${oldProof}`, 12);
  setSetting(db, 'due_soon_days', 99);
  setSetting(db, 'last_backup_at', '2026-01-01T00:00:00.000Z');
  return { oldProof };
}

describe('readBackup', () => {
  it('extracts into a fresh staging folder under one parent and returns the validated preview, changing nothing', async () => {
    oldDevice();
    const before = snapshot();

    const preview = await readBackup(ZIP);

    expect(preview.stagingDir).toMatch(new RegExp(`^${PARENT}/[0-9a-f-]{36}$`));
    expect(unzipMock).toHaveBeenCalledWith(ZIP, preview.stagingDir);
    expect(preview).toMatchObject({
      missing: [],
      counts: { pets: 2, vaccinations: 2, photos: 2 },
      exportedAt: '2026-11-12T14:03:00.000Z',
      appVersion: '1.0.0',
    });
    expect(preview.data).toEqual(sampleBackup());
    expect(snapshot()).toEqual(before);
  });

  it('clears staging folders left by earlier runs', async () => {
    fakeFs.addDir(PARENT);
    fakeFs.addDir(`${PARENT}/old-run`);
    fakeFs.addFile(`${PARENT}/old-run/leftover.txt`);

    await readBackup(ZIP);

    expect(fakeFs.has(`${PARENT}/old-run/leftover.txt`)).toBe(false);
  });

  it('never reuses a leftover folder, even when it cannot be removed: stale files cannot satisfy the new backup', async () => {
    fakeFs.addDir(PARENT);
    fakeFs.addDir(PARENT);
    fakeFs.addDir(`${PARENT}/old-run`);
    fakeFs.addFile(`${PARENT}/old-run/data.json`, 10, { text: JSON.stringify(sampleBackup()), failDelete: true });
    fakeFs.addFile(`${PARENT}/old-run/photos/${PROOF}`, 10, { failDelete: true });
    zipContent = {}; // the new zip has no data.json at all

    expect(await codeOfFailure(readBackup(ZIP))).toBe('NOT_A_BACKUP');
    const target = unzipMock.mock.calls[0][1];
    expect(target).not.toContain('old-run');
    expect(fakeFs.tree(target)).toEqual([]);
  });

  it('uses a different staging folder for every read', async () => {
    const first = await readBackup(ZIP);
    const second = await readBackup(ZIP);

    expect(second.stagingDir).not.toBe(first.stagingDir);
  });

  it('reports referenced photos that are not in the zip and counts only those present', async () => {
    zipContent = { 'data.json': zipContent['data.json'], [`pets/${PET_PHOTO}`]: 10 };

    const preview = await readBackup(ZIP);

    expect(preview.missing).toEqual([PROOF]);
    expect(preview.counts.photos).toBe(1);
  });

  it('ignores photos in the zip that nothing references', async () => {
    zipContent['photos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'] = 10;

    const preview = await readBackup(ZIP);

    expect(preview.counts.photos).toBe(2);
  });

  it('ignores macOS junk (__MACOSX, .DS_Store) instead of refusing the file, and never copies it', async () => {
    zipContent['__MACOSX/._data.json'] = 'x';
    zipContent['__MACOSX/photos/._x.jpg'] = 1;
    zipContent['.DS_Store'] = 'x';
    zipContent['photos/.DS_Store'] = 'x';
    zipContent['pets/.DS_Store'] = 'x';

    const preview = await readBackup(ZIP);
    await applyBackup(preview);

    expect(fakeFs.names('file:///docs/photos')).toEqual([PROOF]);
    expect(fakeFs.names('file:///docs/pets')).toEqual([PET_PHOTO]);
  });

  describe('a refusal changes nothing on a populated device and removes staging', () => {
    const refusals: [string, () => void, string][] = [
      ['text that is not JSON', () => (zipContent['data.json'] = '{ nope'), 'INVALID_JSON'],
      ['JSON with no header', () => (zipContent['data.json'] = '{"hello":1}'), 'NOT_A_BACKUP'],
      ['a zip with no data.json', () => delete zipContent['data.json'], 'NOT_A_BACKUP'],
      ['a file that is not a zip', () => (unzipFailure = Object.assign(new Error('x'), { code: 'ERR_CORRUPT_ARCHIVE' })), 'NOT_A_BACKUP'],
      ['an unzip failure', () => (unzipFailure = Object.assign(new Error('x'), { code: 'ERR_UNZIP' })), 'NOT_A_BACKUP'],
      ['a newer version', () => (zipContent['data.json'] = JSON.stringify({ format: 'petvaccines-backup', schemaVersion: 2 })), 'NEWER_VERSION'],
      ['an invalid body', () => (zipContent['data.json'] = JSON.stringify({ ...sampleBackup(), pets: 'x' })), 'INVALID_BACKUP'],
      ['an invalid reference', () => (zipContent['data.json'] = JSON.stringify({ ...sampleBackup(), vaccinations: [{ ...sampleBackup().vaccinations[0], pet_id: '77777777-7777-4777-8777-777777777777' }] })), 'INVALID_BACKUP'],
      ['another file at the root', () => (zipContent['notes.txt'] = 'x'), 'UNSAFE_ENTRY'],
      ['a file in an unknown folder', () => (zipContent['other/x.jpg'] = 1), 'UNSAFE_ENTRY'],
      ['a nested folder', () => (zipContent['photos/sub/x.jpg'] = 1), 'UNSAFE_ENTRY'],
      ['a photo with another extension', () => (zipContent['photos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png'] = 1), 'UNSAFE_ENTRY'],
      ['an entry refused by the library (path traversal)', () => (unzipFailure = Object.assign(new Error('x'), { code: 'ERR_UNSAFE_PATH' })), 'UNSAFE_ENTRY'],
    ];

    it.each(refusals)('%s', async (_name, arrange, code) => {
      oldDevice();
      const before = snapshot();
      arrange();

      expect(await codeOfFailure(readBackup(ZIP))).toBe(code);

      expect(snapshot()).toEqual(before);
      stagingGone();
    });

    it('an empty unknown folder (UNSAFE_ENTRY)', async () => {
      oldDevice();
      const before = snapshot();
      unzipMock.mockImplementationOnce(async (_source, target) => {
        fakeFs.addDir(target);
        fakeFs.addDir(`${target}/other`);
        fakeFs.addFile(`${target}/data.json`, 1, { text: JSON.stringify(sampleBackup()) });
        return target;
      });

      expect(await codeOfFailure(readBackup(ZIP))).toBe('UNSAFE_ENTRY');
      expect(snapshot()).toEqual(before);
      stagingGone();
    });

    it('a data.json larger than the limit (INVALID_BACKUP)', async () => {
      oldDevice();
      const before = snapshot();
      unzipMock.mockImplementationOnce(async (_source, target) => {
        fakeFs.addDir(target);
        fakeFs.addFile(`${target}/data.json`, MAX_DATA_JSON_BYTES + 1, { text: '{}' });
        return target;
      });

      expect(await codeOfFailure(readBackup(ZIP))).toBe('INVALID_BACKUP');
      expect(snapshot()).toEqual(before);
      stagingGone();
    });
  });

  it('rethrows an unknown extraction failure as it is, with staging removed', async () => {
    unzipFailure = new Error('disk full');

    await expect(readBackup(ZIP)).rejects.toThrow('disk full');
    stagingGone();
  });

  describe('error precedence', () => {
    it('a zip with no data.json is NOT_A_BACKUP whatever else it contains', async () => {
      zipContent = { 'notes.txt': 'x', 'other/y.jpg': 1, [`photos/${PROOF}`]: 1 };

      expect(await codeOfFailure(readBackup(ZIP))).toBe('NOT_A_BACKUP');
    });

    it('a zip with data.json plus an entry outside the allowed set is UNSAFE_ENTRY, even if data.json is invalid', async () => {
      zipContent = { 'data.json': '{ nope', 'notes.txt': 'x' };

      expect(await codeOfFailure(readBackup(ZIP))).toBe('UNSAFE_ENTRY');
    });
  });
});

describe('pickAndReadBackup', () => {
  it('does nothing when the picker is cancelled', async () => {
    pickerMock.mockResolvedValue({ canceled: true, assets: null });

    expect(await pickAndReadBackup()).toBeNull();
    expect(unzipMock).not.toHaveBeenCalled();
  });

  it('reads the chosen file and removes the picker copy from the cache', async () => {
    pickerMock.mockResolvedValue({ canceled: false, assets: [{ uri: ZIP, name: 'b.zip', lastModified: 0 }] });

    const preview = await pickAndReadBackup();

    expect(preview?.counts.pets).toBe(2);
    expect(fakeFs.has(ZIP)).toBe(false);
  });

  it('never deletes a picked file that is outside the cache', async () => {
    fakeFs.addFile('content://provider/b.zip');
    pickerMock.mockResolvedValue({ canceled: false, assets: [{ uri: 'content://provider/b.zip', name: 'b.zip', lastModified: 0 }] });

    await pickAndReadBackup();

    expect(fakeFs.has('content://provider/b.zip')).toBe(true);
  });
});

describe('applyBackup', () => {
  const read = () => readBackup(ZIP);

  it('copies the photos, replaces the data, sweeps the old photos and removes staging', async () => {
    const { oldProof } = oldDevice();
    const preview = await read();

    await applyBackup(preview);

    expect(db.select().from(pets).all().map((p) => p.name).sort()).toEqual(['Mimi', 'Thor']);
    expect(fakeFs.names('file:///docs/pets')).toEqual([PET_PHOTO]);
    expect(fakeFs.names('file:///docs/photos')).toEqual([PROOF]);
    expect(fakeFs.has(`file:///docs/photos/${oldProof}`)).toBe(false);
    expect(fakeFs.has(`file:///docs/pets/${OLD_PHOTO}`)).toBe(false);
    stagingGone();
    expect(getSettings(db)).toMatchObject({ dueSoonDays: 30, lastBackupAt: preview.exportedAt, lastChangeAt: preview.exportedAt });
  });

  it('stores now instead of an exportedAt in the future', async () => {
    zipContent['data.json'] = JSON.stringify({ ...sampleBackup(), exportedAt: '2031-01-01T00:00:00.000Z' });
    const preview = await read();

    await applyBackup(preview);

    const now = new Date(2026, 10, 13, 10).toISOString();
    expect(getSettings(db)).toMatchObject({ lastBackupAt: now, lastChangeAt: now });
  });

  it('imports the rest when a photo is missing: no attachment row, no pet photo', async () => {
    zipContent = { 'data.json': zipContent['data.json'] };
    const preview = await read();

    await applyBackup(preview);

    expect(db.select().from(attachments).all()).toEqual([]);
    expect(db.select().from(pets).all().every((p) => p.photoFile === null)).toBe(true);
    expect(db.select().from(vaccinations).all()).toHaveLength(2);
  });

  it('does not overwrite a file with the same name that is already on the device', async () => {
    fakeFs.addFile(`file:///docs/photos/${PROOF}`, 777);
    const preview = await read();

    await applyBackup(preview);

    expect(fakeFs.size(`file:///docs/photos/${PROOF}`)).toBe(777);
  });

  it('copies through a temporary name, so a final name only ever holds a complete file', async () => {
    const preview = await read();
    fakeFs.addFile(`${preview.stagingDir}/photos/${PROOF}`, 10, { failCopy: true });

    await expect(applyBackup(preview)).rejects.toThrow();

    expect(fakeFs.has(`file:///docs/photos/${PROOF}`)).toBe(false);
    expect(fakeFs.names('file:///docs/photos')).toEqual([]); // the partial temporary file is gone too
  });

  it('does not keep a truncated file on a retry when the cleanup of the partial copy fails', async () => {
    const preview = await read();
    fakeFs.addFile(`${preview.stagingDir}/photos/${PROOF}`, 10, { failCopy: true });
    const deleteSpy = jest.spyOn(File.prototype, 'delete').mockImplementation(() => {
      throw new Error('cannot delete');
    });

    await expect(applyBackup(preview)).rejects.toThrow();
    deleteSpy.mockRestore();
    expect(fakeFs.has(`file:///docs/photos/${PROOF}`)).toBe(false); // whatever is left does not carry the final name
    fakeFs.addFile(`${preview.stagingDir}/photos/${PROOF}`, 10);
    await applyBackup(preview);

    expect(fakeFs.size(`file:///docs/photos/${PROOF}`)).toBe(10);
  });

  it('the orphan sweep removes leftover temporary files', async () => {
    fakeFs.addFile(`file:///docs/photos/${PROOF}.part`, 1);
    fakeFs.addFile(`file:///docs/pets/${PET_PHOTO}.part`, 1);
    const preview = await read();

    await applyBackup(preview);

    expect(fakeFs.names('file:///docs/photos')).toEqual([PROOF]);
    expect(fakeFs.names('file:///docs/pets')).toEqual([PET_PHOTO]);
  });

  it('removes only the files it created when a copy fails part-way, leaving everything else exactly as it was', async () => {
    oldDevice();
    fakeFs.addFile(`file:///docs/pets/${PET_PHOTO}`, 777); // same name as a photo of the backup, already on the device
    const preview = await read();
    fakeFs.addFile(`${preview.stagingDir}/photos/${PROOF}`, 10, { failCopy: true });
    const before = snapshot();

    await expect(applyBackup(preview)).rejects.toThrow();

    expect(snapshot()).toEqual(before);
    expect(fakeFs.size(`file:///docs/pets/${PET_PHOTO}`)).toBe(777);
    expect(getSettings(db).dueSoonDays).toBe(99);
  });

  it('removes the files it created and keeps everything else when the transaction fails', async () => {
    oldDevice();
    fakeFs.addFile(`file:///docs/photos/${PROOF}`, 777);
    fakeFs.addFile('file:///docs/photos/already-here.jpg', 5);
    const preview = await read();
    const before = snapshot();
    const original = db.transaction.bind(db);
    jest.spyOn(db, 'transaction').mockImplementationOnce(((cb: never) =>
      // Fail after the delete step, inside the real transaction, so the rollback is real.
      original(((tx: { insert: () => never }) => {
        tx.insert = () => {
          throw new Error('boom');
        };
        return (cb as (t: unknown) => unknown)(tx);
      }) as never)) as never);

    await expect(applyBackup(preview)).rejects.toThrow();

    expect(snapshot()).toEqual(before);
    expect(fakeFs.size(`file:///docs/photos/${PROOF}`)).toBe(777);
    expect(fakeFs.has(`file:///docs/pets/${PET_PHOTO}`)).toBe(false);
  });

  it('still succeeds when the old photos cannot be deleted', async () => {
    fakeFs.addFile(`file:///docs/photos/${OLD_PHOTO}`, 1, { failDelete: true });
    const preview = await read();

    await expect(applyBackup(preview)).resolves.toBeUndefined();

    expect(db.select().from(pets).all()).toHaveLength(2);
  });

  it('succeeds with the new data in place when the sweep itself throws', async () => {
    oldDevice();
    const sweep = jest.spyOn(files, 'removeOrphanFiles').mockRejectedValueOnce(new Error('sweep'));
    const preview = await read();

    await expect(applyBackup(preview)).resolves.toBeUndefined();

    expect(sweep).toHaveBeenCalledTimes(1);
    expect(db.select().from(pets).all().map((p) => p.name).sort()).toEqual(['Mimi', 'Thor']);
    expect(db.select().from(vaccinations).all()).toHaveLength(2);
    expect(fakeFs.has(`file:///docs/pets/${PET_PHOTO}`)).toBe(true);
    expect(fakeFs.has(`file:///docs/photos/${PROOF}`)).toBe(true);
    expect(getSettings(db).dueSoonDays).toBe(30);
    stagingGone();
  });

  it('refuses a preview that readBackup did not produce', async () => {
    const forged: BackupPreview = { ...(await read()) };

    await expect(applyBackup(forged)).rejects.toThrow();
    expect(db.select().from(pets).all()).toEqual([]);
  });

  it('refuses a preview whose staging folder is gone', async () => {
    const preview = await read();
    discardBackupPreview(preview);

    await expect(applyBackup(preview)).rejects.toThrow();
  });
});

describe('discardBackupPreview', () => {
  it('removes the staging folder and changes nothing else', async () => {
    oldDevice();
    const before = snapshot();
    const preview = await readBackup(ZIP);

    discardBackupPreview(preview);

    stagingGone();
    expect(snapshot()).toEqual(before);
  });
});
