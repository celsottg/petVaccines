import { count, eq } from 'drizzle-orm';

import { attachments } from '@/db/schema';

import { touchLastChange } from './settings';
import type { Attachment, AttachmentInput, Db } from './types';

export const MAX_ATTACHMENTS_PER_VACCINATION = 3;

/** Error message thrown when a vaccination already has the maximum number of attachments. */
export const ATTACHMENT_LIMIT = 'ATTACHMENT_LIMIT';

export function addAttachment(db: Db, row: AttachmentInput): Attachment {
  return db.transaction((tx) => {
    const existing = tx
      .select({ total: count() })
      .from(attachments)
      .where(eq(attachments.vaccinationId, row.vaccinationId))
      .get();
    if ((existing?.total ?? 0) >= MAX_ATTACHMENTS_PER_VACCINATION) {
      throw new Error(ATTACHMENT_LIMIT);
    }
    const attachment = tx
      .insert(attachments)
      .values({ ...row, createdAt: new Date().toISOString() })
      .returning()
      .get();
    touchLastChange(tx);
    return attachment;
  });
}

/** Deletes the row and returns the file name to remove from disk. */
export function deleteAttachment(db: Db, id: string): string {
  return db.transaction((tx) => {
    const attachment = tx.delete(attachments).where(eq(attachments.id, id)).returning().get();
    if (!attachment) throw new Error(`Attachment not found: ${id}`);
    touchLastChange(tx);
    return attachment.file;
  });
}
