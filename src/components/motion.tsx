import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useSeriesColor } from '@/constants/series-colors';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/ui/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Spring used by every pressable: quick, without wobble. */
const PRESS_SPRING = { damping: 20, stiffness: 400, mass: 0.6 };

/**
 * Pressable that sinks slightly while touched (scale ~0.97), with optional haptic
 * feedback on press. Use for buttons and tappable cards; lists keep the opacity effect.
 * @param scaleTo Scale while pressed.
 * @param feedback Haptic played on press.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  feedback,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  feedback?: keyof typeof haptic;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, PRESS_SPRING));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, PRESS_SPRING));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (feedback) haptic[feedback]();
        onPress?.(e);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}

/**
 * Bar fill that grows from zero to `ratio` when it appears and eases between values.
 * @param ratio Filled fraction (0–1).
 * @param color Series color (adjusted for dark mode).
 * @param height Bar thickness.
 */
export function AnimatedFill({ ratio, color, height }: { ratio: number; color: string; height: number }) {
  const series = useSeriesColor();
  const width = useSharedValue(0);
  useEffect(() => {
    width.set(withTiming(Math.max(0, Math.min(1, ratio)), { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [ratio, width]);
  const animated = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: series(color) }, animated]} />;
}

/**
 * Number that counts from its previous value to `value` (e.g. the money left in the
 * month), skipped when the system asks for reduced motion.
 * @param value Target number.
 * @param duration Animation length in ms.
 */
export function useCountUp(value: number, duration = 700): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    const start = from.current;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (cancelled) return;
        if (reduced || start === value) {
          from.current = value;
          setShown(value);
          return;
        }
        const t0 = Date.now();
        const tick = () => {
          const t = Math.min(1, (Date.now() - t0) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          const next = Math.round(start + (value - start) * eased);
          from.current = next;
          setShown(next);
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);
  return shown;
}

/**
 * Gray placeholder that pulses while content is on its way (AI answer, import…).
 * @param width Block width (number or percentage).
 * @param height Block height.
 */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 7,
}: {
  width?: ViewStyle['width'];
  height?: number;
  radius?: number;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.set(withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })), -1));
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: theme.backgroundSelected }, animated]}
    />
  );
}

/**
 * Content that slides in softly when it first appears (list rows, cards).
 * @param index Position in a list, for a small stagger (capped).
 */
export function Appear({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.duration(280).delay(Math.min(index, 6) * 40)} style={style}>
      {children}
    </Animated.View>
  );
}
