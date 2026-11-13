import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MAX_ATTACHMENTS_PER_VACCINATION } from '@/data/attachments';
import { t } from '@/i18n';
import type { PhotoSource } from '@/services/photos';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { PhotoSourceSheet } from './PhotoSourceSheet';

export interface ProofThumb {
  key: string;
  uri: string;
  /** Accessibility label of the thumbnail button. */
  label: string;
}

interface ProofPhotosProps {
  photos: ProofThumb[];
  /** Whether photos can be added at all; false for an archived pet's wallet. The limit of 3 is applied here. */
  editable: boolean;
  onAdd: (source: PhotoSource) => void;
  onOpen: (key: string) => void;
  hint?: string;
  /** A non-blocking problem, such as a refused permission. */
  message?: string;
}

const THUMB = 72;

export function ProofPhotos({ photos, editable, onAdd, onOpen, hint, message }: ProofPhotosProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [choosing, setChoosing] = useState(false);
  const canAdd = editable && photos.length < MAX_ATTACHMENTS_PER_VACCINATION;

  // An archived wallet without photos has nothing to show here.
  if (!editable && photos.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.label, { color: colors.textSecondary }]}>
        {t('photos.proofTitle')}
      </Text>
      {photos.length > 0 ? (
        <View style={[styles.row, { gap: spacing.sm }]}>
          {photos.map((photo) => (
            <Pressable
              key={photo.key}
              accessibilityRole="button"
              accessibilityLabel={photo.label}
              onPress={() => onOpen(photo.key)}>
              <Image
                source={{ uri: photo.uri }}
                contentFit="cover"
                style={{ width: THUMB, height: THUMB, borderRadius: radius.md, backgroundColor: colors.border }}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
      {canAdd ? <Button variant="secondary" label={t('photos.add')} onPress={() => setChoosing(true)} /> : null}
      {hint ? <Text style={[typography.caption, { color: colors.textSecondary }]}>{hint}</Text> : null}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[typography.caption, { color: colors.status.overdue.text }]}>
          {message}
        </Text>
      ) : null}
      <PhotoSourceSheet
        visible={choosing}
        onCancel={() => setChoosing(false)}
        onPick={(source) => {
          setChoosing(false);
          onAdd(source);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
