import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors } from '@/constants/theme';

/** Matches `imageWidth` of the expo-splash-screen plugin in app.json. */
const ICON_SIZE = 200;
const DURATION = 420;
/** Extra time after the animation before unmounting even if its callback never fires. */
const FALLBACK_MARGIN = 300;

/** Fades the overlay out once the icon has started growing. */
const fadeOut = new Keyframe({
  0: { opacity: 1 },
  35: { opacity: 1 },
  100: { opacity: 0, easing: Easing.out(Easing.cubic) },
});

/** Grows the icon slightly while it fades, like it opens into the app. */
const growIcon = new Keyframe({
  0: { transform: [{ scale: 1 }] },
  100: { transform: [{ scale: 1.25 }], easing: Easing.out(Easing.cubic) },
});

/** Hides the native splash; safe to call more than once. */
function hideNativeSplash() {
  SplashScreen.hideAsync().catch(() => {
    // Already hidden.
  });
}

/**
 * Copy of the native splash screen drawn in JS so the app can keep it up while
 * data loads, then animate it away instead of cutting abruptly.
 *
 * The native splash is hidden as soon as this overlay is laid out, whichever state
 * it is in: in release builds the store can finish loading before the first render,
 * so the "loading" branch may never mount.
 *
 * @param ready - When true (store hydrated), the overlay animates out and unmounts.
 */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [gone, setGone] = useState(false);

  // Unmount after the exit animation even if its callback never runs
  // (e.g. animations disabled in the system accessibility settings).
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setGone(true), DURATION + FALLBACK_MARGIN);
    return () => clearTimeout(timer);
  }, [ready]);

  if (gone) return null;

  const background = { backgroundColor: Colors[scheme].background };
  const icon = <Image style={styles.icon} source={require('@/assets/images/splash-icon.png')} />;

  if (!ready) {
    return (
      <View testID="splash-overlay" onLayout={hideNativeSplash} style={[styles.overlay, background]}>
        {icon}
      </View>
    );
  }

  return (
    <Animated.View
      testID="splash-overlay"
      onLayout={hideNativeSplash}
      pointerEvents="none"
      entering={fadeOut.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) scheduleOnRN(setGone, true);
      })}
      style={[styles.overlay, background]}>
      <Animated.View entering={growIcon.duration(DURATION)}>{icon}</Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
});
