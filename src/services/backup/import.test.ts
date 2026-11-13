import * as DocumentPicker from 'expo-document-picker';
import { unzip } from 'react-native-zip-archive';

import { addAttachment } from '@/data/attachments';
import { createPet } from '@/data/pets';
import { getSettings, setSetting } from '@/data/settings';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { attachments, pets, settings, vaccinations } from '@/db/schema';

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

const STAGING = 'file:///cache/petvaccines-import-staging';
const ZIP = 'file:///cache/picked.zip';
const PET_PHOTO = '33333333-3333-4333-8333-333333333333.jpg';
const PROOF = '44444444-4444-4444-8444-444444444444.jpg';
const OLD_PHOTO = '99999999-9999-4999-8999-999999999999.jpg';

/** What the fake `unzip` puts in the staging folder: path inside the zip -> text (or size for a photo). */
let zipContent: Record<string, string | number>;
let unzipFailure: unknown;

function validZip(data: BackupData = sampleBackup()): Record<string, string | number> {
  return { 'data.json': JSON.stringify(data), [`pets/${PET_PHOTO}`]: 10, [`photos/${PROOF}`]: 10 };
}

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
  const v = createVaccination(db, { petId: pet.id, vaccineName: 'Old vaccine', appliedOn: '2026-01-01' });
  const oldProof = '88888888-8888-4888-8888-888888888881.jpg';
  addAttachment(db, { id: oldProof.slice(0, -4), vaccinationId: v.id, file: oldProof, sizeBytes: 1, width: 1, height: 1 });
  fakeFs.addFile(`file:///docs/pets/${OLD_PHOTO}`);
  fakeFs.addFile(`file:///docs/photos/${oldProof}`);
  setSetting(db, 'due_soon_days', 99);
  return { oldProof };
}

describe('readBackup', () => {
  it('extracts into the staging folder and returns the validated preview, changing nothing', async () => {
    oldDevice();
    const before = db.select().from(pets).all();

    const preview = await readBackup(ZIP);

    expect(unzipMock).toHaveBeenCalledWith(ZIP, STAGING);
    expect(preview).toMatchObject({
      stagingDir: STAGING,
      missing: [],
      counts: { pets: 2, vaccinations: 2, photos: 2 },
      exportedAt: '2026-11-12T14:03:00.000Z',
      appVersion: '1.0.0',
    });
    expect(preview.data).toEqual(sampleBackup());
    expect(db.select().from(pets).all()).toEqual(before);
    expect(fakeFs.names('file:///docs/photos')).toEqual(['88888888-8888-4888-8888-888888888881.jpg']);
  });

  it('clears a staging folder left by an interrupted run', async () => {
    fakeFs.addDir(STAGING);
    fakeFs.addFile(`${STAGING}/leftover.txt`);

    await readBackup(ZIP);

    expect(fakeFs.has(`${STAGING}/leftover.txt`)).toBe(false);
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

  it.each([
    ['a file that is not a zip', 'ERR_CORRUPT_ARCHIVE', 'NOT_A_BACKUP'],
    ['an unzip failure', 'ERR_UNZIP', 'NOT_A_BACKUP'],
    ['a path-traversal entry refused by the library', 'ERR_UNSAFE_PATH', 'UNSAFE_ENTRY'],
  ])('maps %s to %s', async (_name, libraryCode, code) => {
    unzipFailure = Object.assign(new Error('x'), { code: libraryCode });

    expect(await codeOfFailure(readBackup(ZIP))).toBe(code);
    expect(fakeFs.hasDir(STAGING)).toBe(false);
  });

  it('rethrows an unknown extraction failure as it is', async () => {
    unzipFailure = new Error('disk full');

    await expect(readBackup(ZIP)).rejects.toThrow('disk full');
    expect(fakeFs.hasDir(STAGING)).toBe(false);
  });

  it('rejects a zip without data.json', async () => {
    zipContent = { [`pets/${PET_PHOTO}`]: 10 };

    expect(await codeOfFailure(readBackup(ZIP))).toBe('NOT_A_BACKUP');
    expect(fakeFs.hasDir(STAGING)).toBe(false);
  });

  it.each([
    ['not json', '{ nope', 'INVALID_JSON'],
    ['json of another app', '{"hello":1}', 'NOT_A_BACKUP'],
    ['a newer version', JSON.stringify({ format: 'petvaccines-backup', schemaVersion: 2 }), 'NEWER_VERSION'],
    ['an invalid body', JSON.stringify({ ...sampleBackup(), pets: 'x' }), 'INVALID_BACKUP'],
  ])('maps data.json with %s to %s and removes the staging folder', async (_name, text, code) => {
    zipContent['data.json'] = text;

    expect(await codeOfFailure(readBackup(ZIP))).toBe(code);
    expect(fakeFs.hasDir(STAGING)).toBe(false);
  });

  it('refuses a data.json larger than the limit as INVALID_BACKUP', async () => {
    zipContent['data.json'] = '{}';
    unzipMock.mockImplementationOnce(async (_source, target) => {
      fakeFs.addDir(target);
      fakeFs.addFile(`${target}/data.json`, MAX_DATA_JSON_BYTES + 1, { text: '{}' });
      return target;
    });

    expect(await codeOfFailure(readBackup(ZIP))).toBe('INVALID_BACKUP');
  });

  it.each([
    ['another file at the root', { 'notes.txt': 'x' }],
    ['a file in an unknown folder', { 'other/x.jpg': 1 }],
    ['a nested folder', { 'photos/sub/x.jpg': 1 }],
    ['a photo with another extension', { 'photos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png': 1 }],
    ['an empty unknown folder', { 'other/': 0 }],
  ])('rejects a zip with %s as UNSAFE_ENTRY, leaving the data untouched', async (_name, extra) => {
    oldDevice();
    const before = db.select().from(pets).all();
    for (const [path, content] of Object.entries(extra)) {
      if (path.endsWith('/')) continue;
      zipContent[path] = content;
    }
    if ('other/' in extra) {
      unzipMock.mockImplementationOnce(async (_source, target) => {
        fakeFs.addDir(target);
        fakeFs.addDir(`${target}/other`);
        fakeFs.addFile(`${target}/data.json`, 1, { text: JSON.stringify(sampleBackup()) });
        return target;
      });
    }

    expect(await codeOfFailure(readBackup(ZIP))).toBe('UNSAFE_ENTRY');
    expect(fakeFs.hasDir(STAGING)).toBe(false);
    expect(db.select().from(pets).all()).toEqual(before);
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
    expect(fakeFs.hasDir(STAGING)).toBe(false);
    expect(getSettings(db)).toMatchObject({ dueSoonDays: 30, lastBackupAt: preview.exportedAt, lastChangeAt: preview.exportedAt });
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

    expect(fakeFs.has(`file:///docs/photos/${PROOF}`)).toBe(true);
    expect(new (jest.requireActual('../fakeFileSystem').fakeModule.File)(`file:///docs/photos/${PROOF}`).size).toBe(777);
  });

  it('removes only the files it created when a copy fails part-way, and leaves the database alone', async () => {
    const { oldProof } = oldDevice();
    const preview = await read();
    fakeFs.addFile(`${STAGING}/photos/${PROOF}`, 10, { failCopy: true });
    const before = db.select().from(pets).all();

    await expect(applyBackup(preview)).rejects.toThrow();

    expect(db.select().from(pets).all()).toEqual(before);
    expect(fakeFs.has(`file:///docs/pets/${PET_PHOTO}`)).toBe(false);
    expect(fakeFs.has(`file:///docs/photos/${PROOF}`)).toBe(false);
    expect(fakeFs.has(`file:///docs/photos/${oldProof}`)).toBe(true);
    expect(fakeFs.has(`file:///docs/pets/${OLD_PHOTO}`)).toBe(true);
    expect(getSettings(db).dueSoonDays).toBe(99);
  });

  it('removes the files it created and keeps the old data when the transaction fails', async () => {
    const { oldProof } = oldDevice();
    fakeFs.addFile('file:///docs/photos/already-here.jpg');
    const preview = await read();
    const original = db.transaction.bind(db);
    jest.spyOn(db, 'transaction').mockImplementationOnce(((cb: never) => {
      // Fail after the delete step, inside the real transaction, so the rollback is real.
      return original(((tx: { insert: () => never }) => {
        tx.insert = () => {
          throw new Error('boom');
        };
        return (cb as (t: unknown) => unknown)(tx);
      }) as never);
    }) as never);

    await expect(applyBackup(preview)).rejects.toThrow();

    expect(db.select().from(pets).all().map((p) => p.name)).toEqual(['Old']);
    expect(getSettings(db).dueSoonDays).toBe(99);
    expect(fakeFs.has(`file:///docs/pets/${PET_PHOTO}`)).toBe(false);
    expect(fakeFs.has(`file:///docs/photos/${PROOF}`)).toBe(false);
    expect(fakeFs.has(`file:///docs/photos/${oldProof}`)).toBe(true);
    expect(fakeFs.has('file:///docs/photos/already-here.jpg')).toBe(true);
  });

  it('still succeeds when the old photos cannot be deleted', async () => {
    fakeFs.addFile(`file:///docs/photos/${OLD_PHOTO}`, 1, { failDelete: true });
    const preview = await read();

    await expect(applyBackup(preview)).resolves.toBeUndefined();

    expect(db.select().from(pets).all()).toHaveLength(2);
  });

  it('still succeeds when the sweep itself throws', async () => {
    const files = jest.requireActual('../files');
    const spy = jest.spyOn(files, 'removeOrphanFiles').mockRejectedValueOnce(new Error('sweep'));
    const preview = await read();

    try {
      await expect(applyBackup(preview)).resolves.toBeUndefined();
    } finally {
      spy.mockRestore();
    }
    expect(db.select().from(pets).all()).toHaveLength(2);
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
    const preview = await readBackup(ZIP);

    discardBackupPreview(preview);

    expect(fakeFs.hasDir(STAGING)).toBe(false);
    expect(db.select().from(pets).all().map((p) => p.name)).toEqual(['Old']);
    expect(fakeFs.has(`file:///docs/pets/${OLD_PHOTO}`)).toBe(true);
  });
});
