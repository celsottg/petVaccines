import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { FormError } from '@/components/FormError';
import { NotFound } from '@/components/NotFound';
import { PetCard } from '@/components/PetCard';
import { VaccinationCard } from '@/components/VaccinationCard';
import { useExportPdf } from '@/components/useExportPdf';
import { useGuardedAction } from '@/components/useGuardedAction';
import { petDetails } from '@/components/petLabels';
import { reactivatePet } from '@/data/pets';
import { useWallet } from '@/data/useVaccinations';
import { filterWallet, type WalletEntry, type WalletFilter } from '@/data/wallet';
import { db } from '@/db/client';
import { todayLocal } from '@/domain/dates';
import { petPhotoUri } from '@/services/files';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

const FILTERS: WalletFilter[] = ['all', 'due_soon', 'overdue'];

export default function WalletScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { pet, wallet, loaded } = useWallet(petId);
  const { colors, spacing, typography } = useTheme();
  const [filter, setFilter] = useState<WalletFilter>('all');
  const guard = useGuardedAction();
  const exportPdf = useExportPdf(petId);

  if (!pet || !wallet) return loaded ? <NotFound /> : null;

  const active = pet.status === 'active';
  const shown = filterWallet(wallet, filter);
  const isEmpty = wallet.current.length === 0 && wallet.previous.length === 0;

  const open = (entry: WalletEntry) =>
    router.push({ pathname: '/vaccinations/[id]', params: { id: entry.vaccination.id } });

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: pet.name }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <PetCard name={pet.name} details={petDetails(pet, todayLocal())}
          photoUri={pet.photoFile ? petPhotoUri(pet.photoFile) : undefined}
        />
        {active ? (
          <Button
            variant="secondary"
            label={t('vaccinations.wallet.edit')}
            onPress={() => router.push({ pathname: '/pets/[petId]/edit', params: { petId: pet.id } })}
          />
        ) : (
          <>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{t('vaccinations.wallet.readOnly')}</Text>
            <Button
              variant="secondary"
              label={t('vaccinations.wallet.reactivate')}
              onPress={() => guard.run(() => reactivatePet(db, pet.id), { unlockOnSuccess: true })}
            />
            <FormError message={guard.error} />
          </>
        )}
        {!isEmpty ? (
          <>
            <Button
              variant="secondary"
              busy={exportPdf.exporting}
              label={t(exportPdf.exporting ? 'vaccinations.wallet.exportingPdf' : 'vaccinations.wallet.exportPdf')}
              onPress={() => void exportPdf.start()}
            />
            <FormError message={exportPdf.error} />
          </>
        ) : null}
        {active && !isEmpty ? (
          <ChoiceChips
            label={t('vaccinations.wallet.filterLabel')}
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((value) => ({ value, label: t(`vaccinations.wallet.filters.${value}`) }))}
          />
        ) : null}
        {isEmpty ? (
          <View style={[styles.empty, { gap: spacing.sm, paddingVertical: spacing.xl }]}>
            <Text style={[typography.subtitle, styles.center, { color: colors.text }]}>
              {t('vaccinations.wallet.empty.title')}
            </Text>
            {active ? (
              <Text style={[typography.body, styles.center, { color: colors.textSecondary }]}>
                {t('vaccinations.wallet.empty.description', { name: pet.name })}
              </Text>
            ) : null}
          </View>
        ) : null}
        {!isEmpty && shown.current.length === 0 && shown.previous.length === 0 ? (
          <Text style={[typography.body, styles.center, { color: colors.textSecondary }]}>
            {t('vaccinations.wallet.emptyFiltered')}
          </Text>
        ) : null}
        {shown.current.map((entry) => (
          <VaccinationCard key={entry.vaccination.id} entry={entry} onPress={() => open(entry)} />
        ))}
        {shown.previous.length > 0 ? (
          <>
            <Text accessibilityRole="header" style={[typography.label, { color: colors.textSecondary }]}>
              {t('vaccinations.wallet.previousTitle')}
            </Text>
            {shown.previous.map((entry) => (
              <VaccinationCard key={entry.vaccination.id} entry={entry} onPress={() => open(entry)} />
            ))}
          </>
        ) : null}
      </ScrollView>
      {active ? (
        <View style={[styles.footer, { padding: spacing.md, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Button
            label={t('vaccinations.wallet.add')}
            onPress={() => router.push({ pathname: '/vaccinations/new', params: { petId: pet.id } })}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { alignItems: 'center' },
  center: { textAlign: 'center' },
  footer: { borderTopWidth: 1 },
});
