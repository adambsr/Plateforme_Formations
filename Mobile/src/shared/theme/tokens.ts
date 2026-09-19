import {
  DynamicColorIOS,
  Platform,
  PlatformColor,
  type ColorValue,
} from 'react-native';

type Palette = {
  ink: string;
  muted: string;
  surface: string;
  canvas: string;
  subtle: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  line: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
};

export const lightPalette: Palette = {
  ink: '#152a43',
  muted: '#405267',
  surface: '#fefefe',
  canvas: '#f5f7fa',
  subtle: '#edf2f8',
  primary: '#1859a6',
  primaryDark: '#123f78',
  primarySoft: '#e9f1fc',
  line: '#d9e1ec',
  danger: '#a12b37',
  dangerSoft: '#fceef0',
  success: '#216446',
  successSoft: '#eaf5ee',
  warning: '#795514',
  warningSoft: '#fcf4df',
};

export const darkPalette: Palette = {
  ink: '#e6edf7',
  muted: '#b3c1d4',
  surface: '#152438',
  canvas: '#101c2c',
  subtle: '#1d3048',
  primary: '#99c4ff',
  primaryDark: '#c4ddff',
  primarySoft: '#213b5c',
  line: '#344860',
  danger: '#ffb4bd',
  dangerSoft: '#472b37',
  success: '#9cddba',
  successSoft: '#203e33',
  warning: '#eed08b',
  warningSoft: '#443920',
};

function adaptive(name: keyof Palette): ColorValue {
  if (Platform.OS === 'android') {
    const resourceName = name.replace(
      /[A-Z]/g,
      (letter) => `_${letter.toLowerCase()}`,
    );
    return PlatformColor(`@color/hsa_${resourceName}`);
  }
  if (Platform.OS === 'ios') {
    return DynamicColorIOS({
      light: lightPalette[name],
      dark: darkPalette[name],
    });
  }
  return lightPalette[name];
}

export const colors = {
  ink: adaptive('ink'),
  muted: adaptive('muted'),
  surface: adaptive('surface'),
  canvas: adaptive('canvas'),
  subtle: adaptive('subtle'),
  primary: adaptive('primary'),
  primaryDark: adaptive('primaryDark'),
  primarySoft: adaptive('primarySoft'),
  line: adaptive('line'),
  danger: adaptive('danger'),
  dangerSoft: adaptive('dangerSoft'),
  success: adaptive('success'),
  successSoft: adaptive('successSoft'),
  warning: adaptive('warning'),
  warningSoft: adaptive('warningSoft'),
  brandDeep: '#123f78',
  onBrand: '#fefefe',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 9,
  md: 16,
} as const;
