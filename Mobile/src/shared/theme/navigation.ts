import type { Theme } from '@react-navigation/native';

import { colors, darkPalette, lightPalette } from './tokens';

export function navigationTheme(dark: boolean): Theme {
  const palette = dark ? darkPalette : lightPalette;
  return {
    dark,
    colors: {
      primary: palette.primary,
      background: palette.canvas,
      card: palette.surface,
      text: palette.ink,
      border: palette.line,
      notification: palette.danger,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '600' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '800' },
    },
  };
}

export const adaptiveNavigationColors = colors;
