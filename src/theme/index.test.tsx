import { renderHook } from '@testing-library/react-native';
import * as RN from 'react-native';

import { theme, useTheme } from '@/theme';

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('theme tokens', () => {
  it('uses #5B4BC4 as the light primary', () => {
    expect(theme.colors.light.primary).toBe('#5B4BC4');
  });
  it('dark primary is a different (lighter) tone', () => {
    expect(theme.colors.dark.primary).not.toBe('#5B4BC4');
    expect(luminance(theme.colors.dark.primary)).toBeGreaterThan(luminance('#5B4BC4'));
  });
  it('exposes spacing, radius and typography', () => {
    expect(Object.keys(theme.spacing)).toEqual(expect.arrayContaining(['xs', 'sm', 'md', 'lg', 'xl']));
    expect(Object.keys(theme.radius).length).toBeGreaterThan(0);
    expect(Object.keys(theme.typography).length).toBeGreaterThan(0);
  });
  it('has the same keys in light and dark', () => {
    expect(Object.keys(theme.colors.dark).sort()).toEqual(Object.keys(theme.colors.light).sort());
    expect(Object.keys(theme.colors.dark.status).sort()).toEqual(['dueSoon', 'neutral', 'ok', 'overdue']);
  });
  it('all colors are valid 6-digit hex, or 8-digit with alpha', () => {
    const all = JSON.stringify(theme.colors).match(/"#[^"]*"/g)!;
    for (const c of all) expect(c).toMatch(/^"#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?"$/);
  });
  it('has a translucent scrim in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) expect(theme.colors[scheme].scrim).toMatch(/^#[0-9A-Fa-f]{8}$/);
  });
});

describe('theme contrast (WCAG)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const c = theme.colors[scheme];
    it(`${scheme}: primary text/links on background >= 4.5:1`, () => {
      expect(contrast(c.primary, c.background)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${scheme}: primary on surface >= 4.5:1`, () => {
      expect(contrast(c.primary, c.surface)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${scheme}: onPrimary on primary (button label) >= 4.5:1`, () => {
      expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${scheme}: text and textSecondary on background >= 4.5:1`, () => {
      expect(contrast(c.text, c.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.textSecondary, c.background)).toBeGreaterThanOrEqual(4.5);
    });
    it.each(['ok', 'dueSoon', 'overdue', 'neutral'] as const)(`${scheme}: status %s badge text >= 4.5:1`, (k) => {
      expect(contrast(c.status[k].text, c.status[k].background)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('useTheme', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    [null, 'light'],
    [undefined, 'light'],
  ] as const)('system scheme %s -> %s', async (system, expected) => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue(system as never);
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe(expected);
    expect(result.current.colors).toBe(theme.colors[expected]);
  });
});
