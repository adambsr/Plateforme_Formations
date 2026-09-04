const fs = require('node:fs');
const path = require('node:path');

function existingServiceFile(value) {
  if (!value) return undefined;
  const filePath = path.isAbsolute(value)
    ? value
    : path.resolve(__dirname, value);
  return fs.existsSync(filePath) ? value : undefined;
}

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
    ...(existingServiceFile(process.env.GOOGLE_SERVICE_INFO_PLIST)
      ? {
          googleServicesFile: existingServiceFile(
            process.env.GOOGLE_SERVICE_INFO_PLIST,
          ),
        }
      : {}),
  },
  android: {
    ...config.android,
    package: config.android?.package ?? 'com.highskillsacademy.formations',
    ...(existingServiceFile(process.env.GOOGLE_SERVICES_JSON)
      ? { googleServicesFile: existingServiceFile(process.env.GOOGLE_SERVICES_JSON) }
      : {}),
  },
});
