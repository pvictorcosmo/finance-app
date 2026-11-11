import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

import { SplashOverlay } from '../splash-overlay';

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
}));
// Minimal Reanimated stand-in: animated views render as plain views and the
// animation callback never runs, which is exactly the failure mode under test.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  class Keyframe {
    duration() {
      return this;
    }
    withCallback() {
      return this;
    }
  }
  const identity = (x: unknown) => x;
  return {
    __esModule: true,
    default: { View },
    Keyframe,
    Easing: { out: () => identity, cubic: identity },
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: jest.fn() }));

const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } };

describe('SplashOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(SplashScreen.hideAsync).mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('hides the native splash while data is still loading', async () => {
    await render(<SplashOverlay ready={false} />);
    await fireEvent(screen.getByTestId('splash-overlay'), 'layout', layout);
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('hides the native splash when data is already loaded on the first render (release builds)', async () => {
    await render(<SplashOverlay ready />);
    await fireEvent(screen.getByTestId('splash-overlay'), 'layout', layout);
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('unmounts after the exit animation even if its callback never fires', async () => {
    const view = await render(<SplashOverlay ready={false} />);
    await view.rerender(<SplashOverlay ready />);
    expect(screen.getByTestId('splash-overlay')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId('splash-overlay')).toBeNull();
  });
});
