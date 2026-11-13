import { router, Stack } from 'expo-router';
import { FlatList, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { FormError } from '@/components/FormError';
import { PetCard } from '@/components/PetCard';
import { useGuardedAction } from '@/components/useGuardedAction';
import { archivedLine, petDetails } from '@/components/petLabels';
import { reactivatePet } from '@/data/pets';
import { usePetSummaries } from '@/data/usePets';
import { db } from '@/db/client';
import { todayLocal } from '@/domain/dates';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

export default function ArchivedScreen() {
  const { colors, spacing, typography } = useTheme();
  const { summaries, loaded } = usePetSummaries('archived');
  const today = todayLocal();
  const guard = useGuardedAction();

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('pets.archived.title') }} />
      <FlatList
        ListHeaderComponent={<FormError message={guard.error} />}
        data={summaries}
        keyExtractor={({ pet }) => pet.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListEmptyComponent={
          loaded ? (
            <Text style={[typography.body, styles.center, { color: colors.textSecondary }]}>{t('pets.archived.empty')}</Text>
          ) : undefined
        }
        renderItem={({ item: { pet } }) => (
          <PetCard
            name={pet.name}
            details={petDetails(pet, today)}
            note={archivedLine(pet.archivedReason, pet.archivedOn)}
            onPress={() => router.push({ pathname: '/pets/[petId]', params: { petId: pet.id } })}>
            <Button
              variant="secondary"
              label={t('pets.archived.reactivate')}
              accessibilityLabel={t('pets.archived.reactivateLabel', { name: pet.name })}
              onPress={() => guard.run(() => reactivatePet(db, pet.id), { unlockOnSuccess: true })}
            />
          </PetCard>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
});
