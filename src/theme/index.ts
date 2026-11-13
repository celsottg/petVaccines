import { useColorScheme } from 'react-native';

type StatusColors = { background: string; text: string };

export type ColorPalette = {
  primary: string;
  onPrimary: string;
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  /** Translucent layer behind modal dialogs. */
  scrim: string;
  status: {
    ok: StatusColors;
    dueSoon: StatusColors;
    overdue: StatusColors;
    neutral: StatusColors;
  };
};

const light: ColorPalette = {
  primary: '#5B4BC4',
  onPrimary: '#FFFFFF',
  background: '#F7F6FB',
  surface: '#FFFFFF',
  border: '#E2E0EC',
  text: '#1B1A22',
  textSecondary: '#5E5C6B',
  scrim: '#00000080',
  status: {
    ok: { background: '#DDF3E4', text: '#17602F' },
    dueSoon: { background: '#FCEFC7', text: '#7A4D00' },
    overdue: { background: '#FBDCDC', text: '#A11B1B' },
    neutral: { background: '#ECEBF2', text: '#4A4857' },
  },
};

// In dark mode the primary is a lighter violet, so text and links in the
// primary color keep a contrast of at least 4.5:1 against the background.
const dark: ColorPalette = {
  primary: '#A99DF2',
  onPrimary: '#1B1440',
  background: '#121117',
  surface: '#1E1D25',
  border: '#34323F',
  text: '#F1F0F5',
  textSecondary: '#B4B2C0',
  scrim: '#000000B3',
  status: {
    ok: { background: '#173A24', text: '#8EE0A9' },
    dueSoon: { background: '#3D3010', text: '#F5CF6B' },
    overdue: { background: '#451B1B', text: '#FF9C9C' },
    neutral: { background: '#2C2B35', text: '#CFCDD9' },
  },
};

export const theme = {
  colors: { light, dark },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  typography: {
    title: { fontSize: 28, fontWeight: '700' },
    subtitle: { fontSize: 20, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: '400' },
    label: { fontSize: 14, fontWeight: '600' },
    caption: { fontSize: 13, fontWeight: '400' },
  },
} as const;

export type ColorScheme = 'light' | 'dark';

export function useTheme() {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return {
    scheme,
    colors: theme.colors[scheme],
    spacing: theme.spacing,
    radius: theme.radius,
    typography: theme.typography,
  };
}
