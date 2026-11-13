import { backupSchema, inspectBackupHeader, type BackupData } from './schema';

// Pure checks on an untrusted backup: classify the JSON, and decide which entries of the
// extracted zip are allowed. Nothing here touches the file system.

export type BackupErrorCode = 'INVALID_JSON' | 'NOT_A_BACKUP' | 'NEWER_VERSION' | 'INVALID_BACKUP' | 'UNSAFE_ENTRY';

/** First schema issue of an invalid backup: a message code and a path, never shown to the tutor. */
export interface BackupIssue {
  message: string;
  path: string;
}

export class BackupError extends Error {
  readonly code: BackupErrorCode;
  readonly issue?: BackupIssue;

  constructor(code: BackupErrorCode, issue?: BackupIssue) {
    super(issue ? `${code}: ${issue.message} at ${issue.path}` : code);
    this.name = 'BackupError';
    this.code = code;
    this.issue = issue;
  }
}

/**
 * Parses and validates the text of `data.json`. The header is inspected first so a
 * newer backup says "update the app" instead of failing full validation.
 */
export function parseBackupJson(text: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('INVALID_JSON');
  }
  const header = inspectBackupHeader(raw);
  if (header.kind === 'not_backup') throw new BackupError('NOT_A_BACKUP');
  if (header.kind === 'newer') throw new BackupError('NEWER_VERSION');

  // FUTURE: when schemaVersion 2 exists, convert older versions (raw.schemaVersion < CURRENT)
  // to the current shape here, before validating. Only version 1 exists today.

  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new BackupError('INVALID_BACKUP', { message: first.message, path: first.path.join('.') });
  }
  return result.data;
}

const UUID_JPG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;
const PHOTO_FOLDERS = ['photos', 'pets'];

/**
 * The allow-list for what an extracted zip may contain: `data.json` at the root,
 * `photos/<uuid>.jpg`, `pets/<uuid>.jpg` and the two folders. `files` and
 * `directories` are paths relative to the staging folder. Anything else throws
 * `UNSAFE_ENTRY`.
 */
export function checkEntries(files: string[], directories: string[]): void {
  for (const dir of directories) {
    if (!PHOTO_FOLDERS.includes(dir)) throw new BackupError('UNSAFE_ENTRY');
  }
  for (const file of files) {
    if (file === 'data.json') continue;
    const parts = file.split('/');
    if (parts.length === 2 && PHOTO_FOLDERS.includes(parts[0]) && UUID_JPG.test(parts[1])) continue;
    throw new BackupError('UNSAFE_ENTRY');
  }
}

/**
 * Checks the entries and returns the photo file names the data points to that are
 * not in the zip (the rest of the backup can still be imported). Files in the zip
 * that nothing references are ignored.
 */
export function checkFiles(data: BackupData, filesInZip: string[], directories: string[] = []): { missing: string[] } {
  checkEntries(filesInZip, directories);
  const present = new Set(filesInZip);
  const missing = [
    ...data.pets.flatMap((pet) => (pet.photo_file !== null && !present.has(`pets/${pet.photo_file}`) ? [pet.photo_file] : [])),
    ...data.attachments.filter((a) => !present.has(`photos/${a.file}`)).map((a) => a.file),
  ];
  return { missing };
}
