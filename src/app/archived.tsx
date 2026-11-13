import { Stack } from 'expo-router';
import { FlatList, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PetCard } from '@/components/PetCard';
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

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('pets.archived.title') }} />
      <FlatList
        data={summaries}
        keyExtractor={({ pet }) => pet.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListEmptyComponent={
          loaded ? (
            <Text style={[typography.body, styles.center, { color: colors.textSecondary }]}>{t('pets.archived.empty')}</Text>
          ) : undefined
        }
        renderItem={({ item: { pet } }) => (
          // Opening the wallet in read-only mode arrives with Task 6.
          <PetCard name={pet.name} details={petDetails(pet, today)} note={archivedLine(pet.archivedReason, pet.archivedOn)}>
            <Button
              variant="secondary"
              label={t('pets.archived.reactivate')}
              accessibilityLabel={t('pets.archived.reactivateLabel', { name: pet.name })}
              onPress={() => reactivatePet(db, pet.id)}
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
