/**
 * Firebase registration files are release-environment inputs. The app remains
 * buildable with Analytics disabled when they are not present.
 */
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    bundleIdentifier:
      config.ios?.bundleIdentifier ?? 'com.highskillsacademy.formations',
    ...(process.env.GOOGLE_SERVICE_INFO_PLIST
      ? { googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST }
      : {}),
  },
  android: {
    ...config.android,
    package: config.android?.package ?? 'com.highskillsacademy.formations',
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
});
