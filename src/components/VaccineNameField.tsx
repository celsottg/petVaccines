import { Pressable, StyleSheet, Text, View } from 'react-native';

import { listCatalog, type CatalogVaccine } from '@/catalog';
import type { Pet } from '@/data/types';
import { normalizeVaccineName } from '@/domain/current';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { FormField } from './FormField';

interface VaccineNameFieldProps {
  species: Pet['species'];
  value: string;
  onChangeText: (text: string) => void;
  onPick: (vaccine: CatalogVaccine) => void;
  error?: string;
}

/** Free text for the vaccine name, with the pet's species catalog listed below as tappable suggestions. */
export function VaccineNameField({ species, value, onChangeText, onPick, error }: VaccineNameFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const typed = normalizeVaccineName(value);
  // Items already spelled out in the field are not suggested again.
  const suggestions = listCatalog(species).filter((vaccine) => {
    const name = normalizeVaccineName(vaccine.name);
    return name !== typed && name.includes(typed);
  });

  return (
    <View style={{ gap: spacing.sm }}>
      <FormField
        label={t('vaccinations.form.vaccine')}
        hint={t('vaccinations.form.vaccineHint')}
        error={error}
        value={value}
        onChangeText={onChangeText}
      />
      {suggestions.length > 0 ? (
        <View accessibilityLabel={t('vaccinations.form.suggestionsLabel')} style={[styles.row, { gap: spacing.sm }]}>
          {suggestions.map((vaccine) => (
            <Pressable
              key={vaccine.id}
              accessibilityRole="button"
              accessibilityLabel={vaccine.name}
              onPress={() => onPick(vaccine)}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                minHeight: 48,
                justifyContent: 'center',
              }}>
              <Text style={[typography.label, { color: colors.text }]}>{vaccine.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
