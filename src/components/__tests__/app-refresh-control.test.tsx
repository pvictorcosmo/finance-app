import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { AppRefreshControl } from '../ui';

// React Native's jest mock of RefreshControl never renders children, so it cannot show
// this bug. Replace it with a stand-in that behaves like Android's SwipeRefreshLayout,
// which draws the ScrollView it wraps.
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => children ?? null,
}));
jest.mock('@/sync/engine', () => ({ pushNow: jest.fn(() => Promise.resolve()) }));
jest.mock('@/updates/fetch-latest', () => ({ fetchLatestUpdate: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

describe('AppRefreshControl', () => {
  // On Android, ScrollView renders *inside* its refresh control:
  // cloneElement(refreshControl, { style }, <NativeScrollView>{content}</NativeScrollView>).
  // The control must therefore pass its children on, or the whole screen content
  // disappears and only the tab bar stays visible.
  it('renders its children (the scroll view on Android)', async () => {
    await render(
      <AppRefreshControl style={{ flex: 1 }}>
        <Text>conteúdo da tela</Text>
      </AppRefreshControl>,
    );
    expect(screen.getByText('conteúdo da tela')).toBeTruthy();
  });
});
