import { router } from 'expo-router';

import { addAttachment, MAX_ATTACHMENTS_PER_VACCINATION } from '@/data/attachments';
import { useAttachments } from '@/data/useAttachments';
import { db } from '@/db/client';
import { t } from '@/i18n';
import { deleteFiles, photoUri } from '@/services/files';
import { preparePhoto, type PreparedPhoto } from '@/services/photos';

import { ProofPhotos } from './ProofPhotos';
import { useGuardedAction } from './useGuardedAction';
import { usePhotoPicker } from './usePhotoPicker';

interface SavedProofPhotosProps {
  vaccinationId: string;
  /** False for an archived pet: photos can be viewed but not added. */
  editable: boolean;
}

/** The proof photos of an existing record. New photos are attached right away; removal happens in the viewer. */
export function SavedProofPhotos({ vaccinationId, editable }: SavedProofPhotosProps) {
  const attachments = useAttachments(vaccinationId);
  const guard = useGuardedAction();

  function attach(photo: PreparedPhoto) {
    guard.run(
      () => {
        try {
          addAttachment(db, { ...photo, vaccinationId });
        } catch (error) {
          // No row points to the file, so it must not stay on disk.
          void deleteFiles([photo.file]);
          throw error;
        }
      },
      { unlockOnSuccess: true },
    );
  }

  const picker = usePhotoPicker(preparePhoto, attach);
  const hint = [
    editable && attachments.length < MAX_ATTACHMENTS_PER_VACCINATION ? t('photos.formHint') : null,
    attachments.length > 0 ? t('photos.openHint') : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ProofPhotos
      photos={attachments.map((attachment, index) => ({
        key: attachment.id,
        uri: photoUri(attachment.file),
        label: t('photos.thumbnail', { index: index + 1, total: attachments.length }),
      }))}
      editable={editable}
      onAdd={picker.pick}
      onOpen={(id) => router.push({ pathname: '/attachments/[id]', params: { id } })}
      hint={hint || undefined}
      message={picker.message ?? guard.error}
    />
  );
}
