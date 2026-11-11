import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic layer over app.json.
 *
 * `APP_VARIANT=development` (used by `node scripts/run-android-dev.js`) builds "Finance Dev":
 * a separate app id, so a local debug build installs next to the official app from
 * EAS instead of replacing it (their signing keys differ, so Android would refuse
 * the update and force an uninstall that wipes the data).
 * Without the variable the config is exactly app.json, so EAS builds are unchanged.
 */
const IS_DEV_VARIANT = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!IS_DEV_VARIANT) return config as ExpoConfig;
  return {
    ...config,
    name: 'Finance Dev',
    slug: config.slug ?? 'finance-app',
    android: { ...config.android, package: 'com.paulovictor.finance.dev' },
    ios: { ...config.ios, bundleIdentifier: 'com.paulovictor.finance.dev' },
  };
};
