const {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidStyles,
} = require('@expo/config-plugins');

const light = {
  hsa_ink: '#152a43',
  hsa_muted: '#405267',
  hsa_surface: '#fefefe',
  hsa_canvas: '#f5f7fa',
  hsa_subtle: '#edf2f8',
  hsa_primary: '#1859a6',
  hsa_primary_dark: '#123f78',
  hsa_primary_soft: '#e9f1fc',
  hsa_line: '#d9e1ec',
  hsa_danger: '#a12b37',
  hsa_danger_soft: '#fceef0',
  hsa_success: '#216446',
  hsa_success_soft: '#eaf5ee',
  hsa_warning: '#795514',
  hsa_warning_soft: '#fcf4df',
};

const dark = {
  hsa_ink: '#e6edf7',
  hsa_muted: '#b3c1d4',
  hsa_surface: '#152438',
  hsa_canvas: '#101c2c',
  hsa_subtle: '#1d3048',
  hsa_primary: '#99c4ff',
  hsa_primary_dark: '#c4ddff',
  hsa_primary_soft: '#213b5c',
  hsa_line: '#344860',
  hsa_danger: '#ffb4bd',
  hsa_danger_soft: '#472b37',
  hsa_success: '#9cddba',
  hsa_success_soft: '#203e33',
  hsa_warning: '#eed08b',
  hsa_warning_soft: '#443920',
};

function assignColors(modResults, palette) {
  return Object.entries(palette).reduce(
    (colors, [name, value]) =>
      AndroidConfig.Colors.assignColorValue(colors, { name, value }),
    modResults,
  );
}

function withHsaTheme(config) {
  config = withAndroidColors(config, (mod) => {
    mod.modResults = assignColors(mod.modResults, light);
    return mod;
  });

  config = withAndroidColorsNight(config, (mod) => {
    mod.modResults = assignColors(mod.modResults, dark);
    return mod;
  });

  return withAndroidStyles(config, (mod) => {
    const group = AndroidConfig.Styles.getAppThemeGroup();
    const appTheme = AndroidConfig.Styles.getStyleParent(
      mod.modResults,
      group,
    );
    if (appTheme) appTheme.$.parent = 'Theme.AppCompat.DayNight.NoActionBar';

    const values = {
      'android:windowBackground': '@color/hsa_canvas',
      'android:colorBackground': '@color/hsa_canvas',
      'android:textColorPrimary': '@color/hsa_ink',
      'android:textColorSecondary': '@color/hsa_muted',
    };
    mod.modResults = Object.entries(values).reduce(
      (styles, [name, value]) =>
        AndroidConfig.Styles.assignStylesValue(styles, {
          add: true,
          parent: group,
          name,
          value,
        }),
      mod.modResults,
    );
    return mod;
  });
}

module.exports = withHsaTheme;

