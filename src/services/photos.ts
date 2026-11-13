import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { addAttachment } from '@/data/attachments';
import type { Attachment, Db } from '@/data/types';

import { deleteFiles, PETS_DIR, PHOTOS_DIR } from './files';
import { fitWithin } from './imageSize';

export type PhotoSource = 'camera' | 'library';

/** A processed photo already stored on disk, not yet linked to a database row. */
export interface PreparedPhoto {
  id: string;
  /** Bare file name, `<id>.jpg`, inside `photos/` or `pets/`. */
  file: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface PhotoOptions {
  /** Called when the camera permission is refused, so the screen can explain it. */
  onPermissionDenied?: () => void;
}

const JPEG_QUALITY = 0.8;

async function pick(source: PhotoSource, options: PhotoOptions): Promise<ImagePicker.ImagePickerAsset | null> {
  // `exif` stays off and the image is processed again below: the stored file is
  // always the re-encoded output, never the original, so no metadata (GPS) survives.
  const pickerOptions: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], exif: false, allowsEditing: false };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      options.onPermissionDenied?.();
      return null;
    }
    result = await ImagePicker.launchCameraAsync(pickerOptions);
  } else {
    // The system photo picker needs no library permission.
    result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
  }
  return result.canceled ? null : (result.assets[0] ?? null);
}

// Files the picker and the manipulator leave in the cache are only copies; the user's own library is never touched.
function removeCacheCopy(uri: string) {
  try {
    if (uri.startsWith(Paths.cache.uri)) new File(uri).delete();
  } catch {
    // The system clears the cache on its own.
  }
}

async function prepare(source: PhotoSource, dirName: string, options: PhotoOptions): Promise<PreparedPhoto | null> {
  const asset = await pick(source, options);
  if (!asset) return null;

  let processedUri: string | undefined;
  try {
    const { width, height, resized } = fitWithin(asset.width, asset.height);
    const context = ImageManipulator.manipulate(asset.uri);
    // One dimension is enough: the other follows the aspect ratio. Smaller images are not resized.
    if (resized) context.resize(width >= height ? { width } : { height });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
    processedUri = saved.uri;

    const dir = new Directory(Paths.document, dirName);
    dir.create({ intermediates: true, idempotent: true });
    const id = randomUUID();
    const target = new File(dir, `${id}.jpg`);
    await new File(saved.uri).move(target);
    processedUri = undefined;
    return { id, file: target.name, sizeBytes: target.size, width: saved.width, height: saved.height };
  } finally {
    if (processedUri) removeCacheCopy(processedUri);
    removeCacheCopy(asset.uri);
  }
}

/**
 * Asks for the permission the source needs (only now), lets the user take or
 * choose a photo, and stores the processed JPEG as `photos/<id>.jpg`: longer
 * side at most 2048 px, quality 0.8. Returns `null` when the user cancels or
 * refuses the permission; a processing failure throws and leaves no file behind.
 */
export function preparePhoto(source: PhotoSource, options: PhotoOptions = {}): Promise<PreparedPhoto | null> {
  return prepare(source, PHOTOS_DIR, options);
}

/** Same as `preparePhoto`, stored as `pets/<id>.jpg` (the pet's profile photo). */
export function preparePetPhoto(source: PhotoSource, options: PhotoOptions = {}): Promise<PreparedPhoto | null> {
  return prepare(source, PETS_DIR, options);
}

/** `preparePhoto` plus the attachment row of an existing vaccination record. */
export async function captureAttachment(
  db: Db,
  vaccinationId: string,
  source: PhotoSource,
  options: PhotoOptions = {},
): Promise<Attachment | null> {
  const photo = await preparePhoto(source, options);
  if (!photo) return null;
  try {
    return addAttachment(db, { ...photo, vaccinationId });
  } catch (error) {
    // No row points to the file, so it must not stay on disk.
    await deleteFiles([photo.file]);
    throw error;
  }
}
