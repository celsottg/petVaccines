import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { attachments, pets, vaccinations } from '@/db/schema';

import type { Attachment, Pet, Vaccination } from './types';

const byCreation = (a: Attachment, b: Attachment) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1;

/** The proof photos of one vaccination, oldest first, kept up to date with the database. */
export function useAttachments(vaccinationId: string): Attachment[] {
  const rows = useLiveQuery(db.select().from(attachments).where(eq(attachments.vaccinationId, vaccinationId)), [
    vaccinationId,
  ]);
  return [...rows.data].sort(byCreation);
}

export interface AttachmentDetail {
  attachment: Attachment;
  vaccination: Vaccination;
  pet: Pet;
  /** Position among the record's photos, 1-based, and how many there are. */
  index: number;
  total: number;
}

/** One photo with its record and pet; `detail` is undefined when any of them is missing. */
export function useAttachmentDetail(id: string): { detail: AttachmentDetail | undefined; loaded: boolean } {
  const attachmentRows = useLiveQuery(db.select().from(attachments).where(eq(attachments.id, id)), [id]);
  const attachment: Attachment | undefined = attachmentRows.data[0];
  const vaccinationId = attachment?.vaccinationId ?? '';
  const vaccinationRows = useLiveQuery(db.select().from(vaccinations).where(eq(vaccinations.id, vaccinationId)), [
    vaccinationId,
  ]);
  const vaccination: Vaccination | undefined = vaccinationRows.data[0];
  const petId = vaccination?.petId ?? '';
  const petRows = useLiveQuery(db.select().from(pets).where(eq(pets.id, petId)), [petId]);
  const siblings = useAttachments(vaccinationId);

  const loaded = [attachmentRows, vaccinationRows, petRows].every((rows) => rows.updatedAt !== undefined);
  const pet = petRows.data[0];
  if (!attachment || !vaccination || !pet) return { detail: undefined, loaded };
  const position = siblings.findIndex((row) => row.id === attachment.id);
  return {
    detail: { attachment, vaccination, pet, index: position + 1, total: siblings.length },
    loaded,
  };
}
