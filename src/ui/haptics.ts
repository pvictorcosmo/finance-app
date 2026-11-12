import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** Runs a haptic call, ignoring devices/platforms without a vibration motor. */
function run(call: () => Promise<void>): void {
  if (!supported) return;
  call().catch(() => {});
}

/**
 * Light tactile feedback, used sparingly so it keeps meaning something:
 * - `tap`: primary buttons and the floating button;
 * - `selection`: chips, pills, steppers and toggles;
 * - `success`: something was saved or marked as paid;
 * - `warning`: a destructive action is about to happen.
 */
export const haptic = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  selection: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
