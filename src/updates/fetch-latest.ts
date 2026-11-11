import * as Updates from 'expo-updates';

/**
 * Checks EAS Update for a new version and downloads it in the background; once
 * downloaded, the "Nova versão pronta" banner shows up. Errors are ignored: being
 * offline must never break the app. No-op in development / Expo Go.
 */
export async function fetchLatestUpdate(): Promise<void> {
  if (!Updates.isEnabled) return;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // Offline or server unavailable: try again later.
  }
}
