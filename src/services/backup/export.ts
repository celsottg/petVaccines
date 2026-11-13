import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { zip } from 'react-native-zip-archive';

import { setSetting } from '@/data/settings';
import { db } from '@/db/client';
import { todayLocal } from '@/domain/dates';
import { t } from '@/i18n';

import { PETS_DIR, PHOTOS_DIR, petPhotoUri, photoUri } from '../files';
import { SHARING_UNAVAILABLE } from '../sharingError';
import { buildBackupData } from './buildData';
import { backupSchema } from './schema';

export { SHARING_UNAVAILABLE };

const STAGING_NAME = 'petvaccines-backup-staging';
const EARLIER_BACKUP = /^petvaccines-backup-.*\.zip$/;

export const backupFileName = (day: string) => `petvaccines-backup-${day}.zip`;

export interface BackupResult {
  /** Photos the rows point to that could not be put in the zip. */
  missingPhotos: number;
}

// Everything built here is a copy in the cache; failing to delete one must never fail the export.
function removeQuietly(entry: File | Directory) {
  try {
    if (entry.exists) entry.delete();
  } catch {
    // The system clears the cache on its own.
  }
}

/** Deletes the zips of earlier runs (kept after sharing) and a staging folder left by a crash. */
function removeEarlierBackups() {
  try {
    for (const entry of Paths.cache.list()) {
      if (entry instanceof File ? EARLIER_BACKUP.test(entry.name) : entry.name === STAGING_NAME) removeQuietly(entry);
    }
  } catch {
    // Nothing to clean, or the cache cannot be listed: the export goes on.
  }
}

async function copyPhoto(sourceUri: string, destination: File): Promise<boolean> {
  try {
    const source = new File(sourceUri);
    if (!source.exists) return false;
    await source.copy(destination);
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds `petvaccines-backup-<date>.zip` (data.json, photos/, pets/) in the cache
 * and opens the system share sheet. `last_backup_at` is stored once the sheet has
 * opened. The zip stays in the cache after sharing (the receiving app may still be
 * reading it); the next export deletes it. A photo missing on disk is left out of
 * the zip and counted. Rejects with `SHARING_UNAVAILABLE` (checked first) or the
 * underlying error, leaving nothing behind.
 */
export async function exportBackup(): Promise<BackupResult> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(SHARING_UNAVAILABLE);

  const now = new Date();
  // Parsing again guarantees that no file name can point outside the photo folders.
  const data = backupSchema.parse(buildBackupData(db, now, Constants.expoConfig?.version ?? '0.0.0'));

  removeEarlierBackups();
  const staging = new Directory(Paths.cache, STAGING_NAME);
  const target = new File(Paths.cache, backupFileName(todayLocal(now)));
  let missing = 0;
  try {
    staging.create({ intermediates: true, idempotent: true });
    const photosDir = new Directory(staging, PHOTOS_DIR);
    const petsDir = new Directory(staging, PETS_DIR);
    photosDir.create();
    petsDir.create();

    const json = new File(staging, 'data.json');
    json.create({ overwrite: true });
    await json.write(JSON.stringify(data, null, 2));

    let missingPhotos = 0;
    for (const { file } of data.attachments) {
      if (!(await copyPhoto(photoUri(file), new File(photosDir, file)))) missingPhotos += 1;
    }
    for (const { photo_file: file } of data.pets) {
      if (file !== null && !(await copyPhoto(petPhotoUri(file), new File(petsDir, file)))) missingPhotos += 1;
    }

    await zip(staging.uri, target.uri);
    await Sharing.shareAsync(target.uri, {
      mimeType: 'application/zip',
      UTI: 'public.zip-archive',
      dialogTitle: t('backup.shareTitle'),
    });
    missing = missingPhotos;
  } catch (failure) {
    removeQuietly(target);
    throw failure;
  } finally {
    removeQuietly(staging);
  }
  // Outside the try: the zip is already shared, so a failure here must not delete it.
  db.transaction((tx) => setSetting(tx, 'last_backup_at', now.toISOString()));
  return { missingPhotos: missing };
}
