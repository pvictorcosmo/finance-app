import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors } from '@/constants/theme';

/** Matches `imageWidth` of the expo-splash-screen plugin in app.json. */
const ICON_SIZE = 200;
const DURATION = 420;

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

/**
 * Copy of the native splash screen drawn in JS so the app can keep it up while
 * data loads, then animate it away instead of cutting abruptly.
 *
 * @param ready - When true (store hydrated), the overlay animates out and unmounts.
 */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [gone, setGone] = useState(false);

  if (gone) return null;

  const background = { backgroundColor: Colors[scheme].background };
  const icon = <Image style={styles.icon} source={require('@/assets/images/splash-icon.png')} />;

  if (!ready) {
    return (
      // The native splash is hidden only after this identical view has been laid out.
      <View onLayout={() => SplashScreen.hideAsync()} style={[styles.overlay, background]}>
        {icon}
      </View>
    );
  }

  return (
    <Animated.View
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
