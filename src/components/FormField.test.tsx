import { render, screen } from '@testing-library/react-native';

import { defaultTestId, FormField } from './FormField';

describe('FormField test ids', () => {
  it('derives a stable id from the label without accents', () => {
    expect(defaultTestId('Nome')).toBe('input-nome');
    expect(defaultTestId('Data de aplicação')).toBe('input-data-de-aplicacao');
    expect(defaultTestId('Raça (opcional)')).toBe('input-raca-opcional');
  });

  it('puts the id on the text input, not on the label', async () => {
    await render(<FormField label="Nome" value="" onChangeText={() => {}} />);
    expect(screen.getByTestId('input-nome').props.accessibilityLabel).toBe('Nome');
    expect(screen.getAllByTestId('input-nome')).toHaveLength(1);
  });

  it('lets the screen choose the id', async () => {
    await render(<FormField label="Nome" testID="pet-name" value="" onChangeText={() => {}} />);
    expect(screen.getByTestId('pet-name')).toBeTruthy();
  });
});
