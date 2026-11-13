import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PetCard } from '@/components/PetCard';
import { badgeLabel, petDetails } from '@/components/petLabels';
import { useArchivedCount, usePetSummaries } from '@/data/usePets';
import { todayLocal } from '@/domain/dates';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

export default function PetsScreen() {
  const { colors, spacing, typography } = useTheme();
  const { summaries, loaded } = usePetSummaries('active');
  const archivedCount = useArchivedCount();
  const today = todayLocal();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false, title: t('pets.title') }} />
      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg, gap: spacing.md }]}>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
          {t('pets.title')}
        </Text>
        {loaded && summaries.length === 0 ? (
          <View style={[styles.empty, { gap: spacing.sm, paddingVertical: spacing.xl }]}>
            <Text style={[typography.subtitle, styles.center, { color: colors.text }]}>{t('pets.empty.title')}</Text>
            <Text style={[typography.body, styles.center, { color: colors.textSecondary }]}>
              {t('pets.empty.description')}
            </Text>
          </View>
        ) : null}
        {summaries.map(({ pet, badge }) => (
          <PetCard
            key={pet.id}
            name={pet.name}
            details={petDetails(pet, today)}
            badge={badge ? { status: badge.status, label: badgeLabel(badge) } : undefined}
            // Task 6 points this at the pet's wallet; until then it opens the edit screen.
            onPress={() => router.push({ pathname: '/pets/[petId]/edit', params: { petId: pet.id } })}
          />
        ))}
        {archivedCount > 0 ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/archived')}
            style={{ paddingVertical: spacing.sm }}>
            <Text style={[typography.label, { color: colors.primary }]}>
              {t('pets.archivedLink', { count: archivedCount })}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { padding: spacing.md, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Button label={t('pets.add')} onPress={() => router.push('/pets/new')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  empty: { alignItems: 'center' },
  center: { textAlign: 'center' },
  footer: { borderTopWidth: 1 },
});
