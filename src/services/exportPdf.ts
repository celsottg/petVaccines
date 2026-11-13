import { eq, inArray } from 'drizzle-orm';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { db } from '@/db/client';
import { attachments, pets, vaccinations } from '@/db/schema';
import { todayLocal } from '@/domain/dates';

import { photoUri } from './files';
import { buildCardHtml, pdfFileName, type CardPhoto } from './pdf';
import { cardLabels } from './pdfLabels';

/** Error messages the screen tells apart from a generic failure. */
export const PET_NOT_FOUND = 'PET_NOT_FOUND';
export const SHARING_UNAVAILABLE = 'SHARING_UNAVAILABLE';

// A4 at 72 ppi, the unit `expo-print` uses; the default is US Letter.
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

/** The stored photos are always JPEG (`photos.ts` re-encodes them). `null` when the file cannot be read. */
async function readDataUri(name: string): Promise<string | null> {
  try {
    const base64 = await new File(photoUri(name)).base64();
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
}

// The files are only copies in the cache; failing to delete one must never fail the export.
function removeQuietly(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // The system clears the cache on its own.
  }
}

/**
 * Builds the PDF of a pet's wallet (all applications and the proof photos) on
 * the device and opens the system share sheet with it. A photo that cannot be
 * read is replaced by a line in the PDF. Rejects with `PET_NOT_FOUND`,
 * `SHARING_UNAVAILABLE` (checked first, before any work) or the underlying error.
 */
export async function exportPetPdf(petId: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(SHARING_UNAVAILABLE);

  const pet = db.select().from(pets).where(eq(pets.id, petId)).get();
  if (!pet) throw new Error(PET_NOT_FOUND);
  const records = db.select().from(vaccinations).where(eq(vaccinations.petId, petId)).all();
  const rows = records.length
    ? db
        .select()
        .from(attachments)
        .where(
          inArray(
            attachments.vaccinationId,
            records.map((record) => record.id),
          ),
        )
        .all()
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1))
    : [];

  // One at a time: each photo is a few MB of text, so they are not all held in flight at once.
  const photos: CardPhoto[] = [];
  for (const row of rows) photos.push({ vaccinationId: row.vaccinationId, dataUri: await readDataUri(row.file) });

  const generatedOn = todayLocal();
  const html = buildCardHtml({ pet, vaccinations: records, photos, generatedOn, labels: cardLabels() });

  const printed = new File((await Print.printToFileAsync({ html, width: PAGE_WIDTH, height: PAGE_HEIGHT })).uri);
  const target = new File(Paths.cache, pdfFileName(pet.name, generatedOn));
  try {
    // `expo-print` names the file randomly; the share sheet shows the name, so give it a readable one.
    removeQuietly(target);
    await printed.move(target);
    await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  } finally {
    removeQuietly(printed);
    removeQuietly(target);
  }
}
