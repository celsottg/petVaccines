import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { unzip } from 'react-native-zip-archive';

import { db } from '@/db/client';

import { PETS_DIR, PHOTOS_DIR, removeOrphanFiles } from '../files';
import { replaceAllData } from './replaceAllData';
import { backupSchema, type BackupData } from './schema';
import { BackupError, checkEntries, checkFiles, isJunkEntry, parseBackupJson } from './validate';

export { BackupError, type BackupErrorCode } from './validate';

// Every read extracts into its own new folder under this one parent, so a leftover can never mix with a new extraction.
const STAGING_PARENT = 'petvaccines-import';
const TEMP_SUFFIX = '.part';
// A real data.json is a few hundred KB; this only stops a hostile file from exhausting memory while parsing.
export const MAX_DATA_JSON_BYTES = 20 * 1024 * 1024;

export interface BackupPreview {
  data: BackupData;
  /** URI of the cache folder the zip was extracted into. */
  stagingDir: string;
  /** Photo files the data points to that the zip does not hold. */
  missing: string[];
  /** `photos` counts the photo files actually present in the zip and referenced by the data. */
  counts: { pets: number; vaccinations: number; photos: number };
  exportedAt: string;
  appVersion: string;
}

// Only previews made by `readBackup` can be applied: it validated them and holds their staging folder.
const issued = new WeakSet<BackupPreview>();

function removeQuietly(entry: File | Directory) {
  try {
    if (entry.exists) entry.delete();
  } catch {
    // The system clears the cache on its own.
  }
}


function isZipError(failure: unknown, ...codes: string[]) {
  const code = (failure as { code?: unknown } | null)?.code;
  return typeof code === 'string' && codes.includes(code);
}

/** What is in the extracted folder, as paths relative to it. Only `photos/` and `pets/` are looked into. */
function walk(staging: Directory): { files: string[]; directories: string[] } {
  const files: string[] = [];
  const directories: string[] = [];
  for (const entry of staging.list()) {
    if (isJunkEntry(entry.name)) continue; // never looked into, never copied
    if (entry instanceof File) {
      files.push(entry.name);
      continue;
    }
    directories.push(entry.name);
    if (entry.name !== PHOTOS_DIR && entry.name !== PETS_DIR) continue;
    for (const child of entry.list()) {
      if (isJunkEntry(child.name)) continue;
      if (child instanceof File) files.push(`${entry.name}/${child.name}`);
      else directories.push(`${entry.name}/${child.name}`);
    }
  }
  return { files, directories };
}

/**
 * Extracts a backup zip into a fresh staging folder in the cache and validates it.
 * Changes nothing in the database or the photo folders. Throws `BackupError`
 * (`NOT_A_BACKUP`, `INVALID_JSON`, `NEWER_VERSION`, `INVALID_BACKUP`, `UNSAFE_ENTRY`) or
 * the underlying error; on any failure the staging folder is removed.
 * The library refuses `../` and absolute entries and skips symlinks, and the extracted
 * tree is then checked against the allow-list anyway.
 */
export async function readBackup(zipUri: string): Promise<BackupPreview> {
  const parent = new Directory(Paths.cache, STAGING_PARENT);
  removeQuietly(parent); // leftovers of interrupted runs; best effort, since the folder below is new anyway
  const staging = new Directory(parent, randomUUID());
  staging.create({ intermediates: true });
  try {
    try {
      await unzip(zipUri, staging.uri);
    } catch (failure) {
      if (isZipError(failure, 'ERR_UNSAFE_PATH')) throw new BackupError('UNSAFE_ENTRY');
      if (isZipError(failure, 'ERR_CORRUPT_ARCHIVE', 'ERR_UNZIP', 'ERR_INVALID_PATH')) throw new BackupError('NOT_A_BACKUP');
      throw failure;
    }

    const { files, directories } = walk(staging);
    // No data.json: this is not a backup, whatever else the zip holds. With it, strangers are unsafe.
    if (!files.includes('data.json')) throw new BackupError('NOT_A_BACKUP');
    checkEntries(files, directories);
    const json = new File(staging, 'data.json');
    if (json.size > MAX_DATA_JSON_BYTES) throw new BackupError('INVALID_BACKUP', { message: 'too_large', path: 'data.json' });

    const data = parseBackupJson(await json.text());
    const { missing } = checkFiles(data, files, directories);
    const referenced = data.attachments.length + data.pets.filter((pet) => pet.photo_file !== null).length;
    const preview: BackupPreview = {
      data,
      stagingDir: staging.uri,
      missing,
      counts: { pets: data.pets.length, vaccinations: data.vaccinations.length, photos: referenced - missing.length },
      exportedAt: data.exportedAt,
      appVersion: data.appVersion,
    };
    issued.add(preview);
    return preview;
  } catch (failure) {
    removeQuietly(staging);
    throw failure;
  }
}

/** Opens the system picker; resolves with the preview of the chosen zip, or `null` when the tutor cancels. */
export async function pickAndReadBackup(): Promise<BackupPreview | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const uri = result.assets[0].uri;
  try {
    return await readBackup(uri);
  } finally {
    // The picker's copy lives in the cache; never delete a file that is not ours (a `content://` original).
    if (uri.startsWith(Paths.cache.uri)) removeQuietly(new File(uri));
  }
}

/** The tutor cancelled at the confirmation: drop the extracted files; nothing else changed. */
export function discardBackupPreview(preview: BackupPreview): void {
  removeQuietly(new Directory(preview.stagingDir));
}

function removeAll(uris: string[]) {
  for (const uri of uris) removeQuietly(new File(uri));
}

/**
 * Replaces everything on the device with the backup. Order, so that a crash at any point
 * leaves either the old data intact or the new data complete:
 * 1. copy the referenced photos into `photos/` and `pets/` (a name already there is kept;
 *    only the files created here are ever removed on failure);
 * 2. replace the database in one transaction;
 * 3. after the commit, sweep the photos of the old data and remove the staging folder
 *    (failures here do not fail the import).
 * Rejects without changing the database if step 1 or 2 fails. Reminders re-sync by
 * themselves when the data changes.
 */
export async function applyBackup(preview: BackupPreview): Promise<void> {
  const staging = new Directory(preview.stagingDir);
  if (!issued.has(preview) || !staging.exists) throw new Error('The backup is no longer ready to import');
  const data = backupSchema.parse(preview.data); // names are re-checked before any path is built from them
  const missing = new Set(preview.missing);

  const copies: [folder: string, name: string][] = [
    ...data.pets.flatMap((pet): [string, string][] => (pet.photo_file !== null && !missing.has(pet.photo_file) ? [[PETS_DIR, pet.photo_file]] : [])),
    ...data.attachments.filter((a) => !missing.has(a.file)).map((a): [string, string] => [PHOTOS_DIR, a.file]),
  ];

  // Each photo is copied to `<name>.part` and renamed once complete, so a final name only ever holds a
  // whole file (an interrupted copy leaves a `.part` that the orphan sweep deletes). Only URIs are kept:
  // a moved `File` changes its own.
  const created: string[] = [];
  try {
    for (const folder of [PHOTOS_DIR, PETS_DIR]) new Directory(Paths.document, folder).create({ intermediates: true, idempotent: true });
    for (const [folder, name] of copies) {
      const destination = new File(new Directory(Paths.document, folder), name);
      if (destination.exists) continue;
      const temporary = new File(new Directory(Paths.document, folder), `${name}${TEMP_SUFFIX}`);
      removeQuietly(temporary); // a stale one from an earlier interrupted run
      created.push(temporary.uri, destination.uri); // recorded before copying: a copy that fails part-way leaves a partial file
      await new File(new Directory(staging, folder), name).copy(temporary);
      temporary.move(destination);
    }
    replaceAllData(db, data, preview.missing);
  } catch (failure) {
    removeAll(created);
    throw failure;
  }

  try {
    await removeOrphanFiles(db);
  } catch {
    // The next app start sweeps them.
  }
  removeQuietly(staging);
}
