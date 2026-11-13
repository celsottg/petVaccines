import { createTestDb } from '@/data/testDb';
import { newAttachment, newPet, newVaccination } from '@/data/testHelpers';
import { pets } from '@/db/schema';

import { fakeFs } from './fakeFileSystem';
import { deleteFiles, findOrphans, petPhotoUri, photoUri, removeOrphanFiles } from './files';

jest.mock('expo-file-system', () => jest.requireActual('./fakeFileSystem').fakeModule);

const PHOTOS = 'file:///docs/photos';
const PETS = 'file:///docs/pets';

beforeEach(() => fakeFs.reset());

describe('findOrphans', () => {
  it('returns the files on disk that nothing references', () => {
    expect(findOrphans(['a.jpg', 'b.jpg', 'c.jpg'], ['a.jpg', 'c.jpg'])).toEqual(['b.jpg']);
  });

  it('returns an empty list when everything is referenced', () => {
    expect(findOrphans(['a.jpg', 'b.jpg'], ['a.jpg', 'b.jpg', 'gone.jpg'])).toEqual([]);
  });
});

describe('uris', () => {
  it('points proof photos into photos/ and pet photos into pets/ of the document directory', () => {
    expect(photoUri('x.jpg')).toBe(`${PHOTOS}/x.jpg`);
    expect(petPhotoUri('y.jpg')).toBe(`${PETS}/y.jpg`);
  });
});

describe('deleteFiles', () => {
  it('removes each name from both photos/ and pets/', async () => {
    fakeFs.addFile(`${PHOTOS}/a.jpg`);
    fakeFs.addFile(`${PETS}/b.jpg`);
    fakeFs.addFile(`${PHOTOS}/keep.jpg`);

    await deleteFiles(['a.jpg', 'b.jpg']);

    expect(fakeFs.names(PHOTOS)).toEqual(['keep.jpg']);
    expect(fakeFs.names(PETS)).toEqual([]);
  });

  it('ignores names that do not exist and an empty list', async () => {
    await expect(deleteFiles(['missing.jpg'])).resolves.toBeUndefined();
    await expect(deleteFiles([])).resolves.toBeUndefined();
  });

  it('keeps going when one file cannot be deleted', async () => {
    fakeFs.addFile(`${PHOTOS}/stuck.jpg`, 1, { failDelete: true });
    fakeFs.addFile(`${PHOTOS}/b.jpg`);

    await expect(deleteFiles(['stuck.jpg', 'b.jpg'])).resolves.toBeUndefined();

    expect(fakeFs.names(PHOTOS)).toEqual(['stuck.jpg']);
  });

  it('refuses names that would leave the photo folders', async () => {
    fakeFs.addFile('file:///docs/secret.jpg');

    await deleteFiles(['../secret.jpg', 'photos/../secret.jpg']);

    expect(fakeFs.has('file:///docs/secret.jpg')).toBe(true);
  });
});

describe('removeOrphanFiles', () => {
  it('deletes files that no attachment or pet photo references and keeps the rest', async () => {
    const db = createTestDb();
    const pet = newPet(db);
    const attachment = newAttachment(db, newVaccination(db, pet.id).id);
    db.update(pets).set({ photoFile: 'pet-photo.jpg' }).run();
    fakeFs.addDir(PHOTOS);
    fakeFs.addDir(PETS);
    fakeFs.addFile(`${PHOTOS}/${attachment.file}`);
    fakeFs.addFile(`${PHOTOS}/stray.jpg`);
    fakeFs.addFile(`${PETS}/pet-photo.jpg`);
    fakeFs.addFile(`${PETS}/old-pet.jpg`);

    await removeOrphanFiles(db);

    expect(fakeFs.names(PHOTOS)).toEqual([attachment.file]);
    expect(fakeFs.names(PETS)).toEqual(['pet-photo.jpg']);
  });

  it('does nothing when the folders do not exist yet', async () => {
    await expect(removeOrphanFiles(createTestDb())).resolves.toBeUndefined();
  });
});
