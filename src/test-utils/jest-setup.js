/* global jest */
/**
 * Global Jest setup.
 *
 * Reanimated 4's own mock initializes its CSS module, which throws under JSReanimated
 * in this version, so a minimal stand-in covers what the app uses: animated values
 * jump straight to their target and animated components render as plain ones.
 */
jest.mock('react-native-reanimated', () => {
  const { View, Text } = jest.requireActual('react-native');
  // Entering/layout animation builders: every chained call returns the builder.
  const builder = new Proxy({}, { get: () => () => builder });
  const identity = (value) => value;
  return {
    __esModule: true,
    default: { View, Text, createAnimatedComponent: identity },
    View,
    Text,
    createAnimatedComponent: identity,
    useSharedValue: (initial) => {
      const shared = { value: initial, get: () => shared.value, set: (next) => (shared.value = next) };
      return shared;
    },
    useAnimatedStyle: (factory) => factory(),
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    withSequence: (...values) => values[values.length - 1],
    Easing: { out: identity, in: identity, inOut: identity, cubic: identity, linear: identity },
    FadeIn: builder,
    FadeInDown: builder,
    FadeOut: builder,
    LinearTransition: builder,
  };
});
// Persisted stores (finance data, hide-values preference) use AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
