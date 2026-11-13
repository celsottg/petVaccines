import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormError } from '@/components/FormError';
import { NotFound } from '@/components/NotFound';
import { useGuardedAction } from '@/components/useGuardedAction';
import { ZoomableImage } from '@/components/ZoomableImage';
import { deleteAttachment } from '@/data/attachments';
import { useAttachmentDetail } from '@/data/useAttachments';
import { db } from '@/db/client';
import { t } from '@/i18n';
import { deleteFiles, photoUri } from '@/services/files';
import { useTheme } from '@/theme';

/** Screen 8: a proof photo full screen, with zoom. Deleting is not offered for an archived pet. */
export default function AttachmentViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, loaded } = useAttachmentDetail(id);
  const { colors, spacing } = useTheme();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const removed = useRef<string>(undefined);
  const guard = useGuardedAction();

  // Also covers the moment right after the photo is deleted, before navigation finishes.
  if (!detail) return loaded && !leaving ? <NotFound /> : null;

  const { attachment, vaccination, pet, index, total } = detail;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('photos.viewer.title') }} />
      <ZoomableImage
        uri={photoUri(attachment.file)}
        label={t('photos.viewer.imageLabel', { index, total, vaccine: vaccination.vaccineName })}
      />
      {pet.status === 'active' ? (
        <View style={[styles.footer, { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <FormError message={guard.error} />
          <Button variant="danger" label={t('photos.viewer.delete')} onPress={() => setConfirmingDelete(true)} />
        </View>
      ) : null}
      <ConfirmDialog
        visible={confirmingDelete}
        destructive
        title={t('photos.viewer.deleteConfirm.title')}
        message={t('photos.viewer.deleteConfirm.message')}
        confirmLabel={t('photos.viewer.deleteConfirm.confirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          guard.run(
            () => {
              removed.current = deleteAttachment(db, attachment.id);
            },
            {
              onSuccess: () => {
                // The row is gone; a file that cannot be removed now is swept at the next start.
                if (removed.current) void deleteFiles([removed.current]);
                setLeaving(true);
                if (router.canGoBack()) router.back();
                else router.replace({ pathname: '/vaccinations/[id]', params: { id: vaccination.id } });
              },
            },
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { borderTopWidth: 1 },
});
