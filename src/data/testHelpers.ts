import { addAttachment } from './attachments';
import { createPet } from './pets';
import type { Attachment, Db, Pet, Vaccination } from './types';
import { createVaccination } from './vaccinations';

export const newPet = (db: Db, overrides: Partial<Parameters<typeof createPet>[1]> = {}): Pet =>
  createPet(db, { name: 'Rex', species: 'dog', ...overrides });

export const newVaccination = (db: Db, petId: string, vaccineName = 'Antirrábica'): Vaccination =>
  createVaccination(db, { petId, vaccineName, appliedOn: '2026-11-01' });

let attachmentSeq = 0;
export const newAttachment = (db: Db, vaccinationId: string): Attachment => {
  attachmentSeq += 1;
  const id = `00000000-0000-4000-8000-${String(attachmentSeq).padStart(12, '0')}`;
  return addAttachment(db, { id, vaccinationId, file: `${id}.jpg`, sizeBytes: 1000, width: 800, height: 600 });
};
