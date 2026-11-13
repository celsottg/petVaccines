import { Directory, File, Paths } from 'expo-file-system';

import { attachments, pets } from '@/db/schema';
import type { Db } from '@/data/types';

/** Folders inside the app's document directory. Names stored in the database are bare (`<uuid>.jpg`). */
export const PHOTOS_DIR = 'photos';
export const PETS_DIR = 'pets';

const folder = (name: string) => new Directory(Paths.document, name);

/** `uri` of a proof photo, for `expo-image`. */
export function photoUri(file: string): string {
  return new File(folder(PHOTOS_DIR), file).uri;
}

/** `uri` of a pet's profile photo, for `expo-image`. */
export function petPhotoUri(file: string): string {
  return new File(folder(PETS_DIR), file).uri;
}

// Names come from our own database, but a stray separator must never reach outside the photo folders.
const isPlainName = (name: string) => name.length > 0 && !name.includes('/') && !name.includes('\\') && name !== '..';

/**
 * Removes each name from both `photos/` and `pets/` (names are `<uuid>.jpg`, so
 * they cannot collide). Best effort: a missing file is fine, and one that cannot
 * be deleted is left for `removeOrphanFiles` instead of failing the caller.
 */
export async function deleteFiles(names: string[]): Promise<void> {
  for (const name of names) {
    if (!isPlainName(name)) continue;
    for (const dir of [PHOTOS_DIR, PETS_DIR]) {
      try {
        const file = new File(folder(dir), name);
        if (file.exists) file.delete();
      } catch {
        // The next app start sweeps whatever is left.
      }
    }
  }
}

/** The files on disk that nothing references. Pure. */
export function findOrphans(onDisk: string[], referenced: string[]): string[] {
  const used = new Set(referenced);
  return onDisk.filter((name) => !used.has(name));
}

function namesIn(dir: Directory): string[] {
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .map((entry) => entry.name);
}

/**
 * Deletes photo files that no attachment or pet row points to (left behind by a
 * failed delete or an unsaved form). Run it once at app start, when no form is
 * open: a pending photo of an open form is not referenced yet.
 */
export async function removeOrphanFiles(db: Db): Promise<void> {
  const referenced = [
    ...db.select({ file: attachments.file }).from(attachments).all().map((row) => row.file),
    ...db.select({ file: pets.photoFile }).from(pets).all().flatMap((row) => (row.file ? [row.file] : [])),
  ];
  for (const dir of [PHOTOS_DIR, PETS_DIR]) {
    await deleteFilesIn(dir, findOrphans(namesIn(folder(dir)), referenced));
  }
}

async function deleteFilesIn(dir: string, names: string[]): Promise<void> {
  for (const name of names) {
    try {
      new File(folder(dir), name).delete();
    } catch {
      // Left for the next start.
    }
  }
}
