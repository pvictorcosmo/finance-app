/**
 * Builds the "Finance Dev" debug app and installs it on the phone connected by USB
 * (`node scripts/run-android-dev.js`). Works the same in cmd, PowerShell and Git Bash, since
 * setting environment variables inline differs between those shells.
 *
 * It is not an npm script on purpose: package.json scripts are part of the native
 * fingerprint, and changing them would make OTA updates skip the installed APK.
 *
 * Requirements: JDK 17, Android SDK (ANDROID_HOME) and USB debugging allowed on the phone.
 */
const { spawnSync } = require('node:child_process');

const result = spawnSync('npx', ['expo', 'run:android', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, APP_VARIANT: 'development' },
});
process.exit(result.status ?? 1);
