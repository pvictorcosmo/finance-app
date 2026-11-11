import { act, render, renderHook, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { pushNow } from '@/sync/engine';
import { fetchLatestUpdate } from '@/updates/fetch-latest';

import { FormScreen, Screen } from '../ui';

jest.mock('@/sync/engine', () => ({ pushNow: jest.fn(() => Promise.resolve()) }));
jest.mock('@/updates/fetch-latest', () => ({ fetchLatestUpdate: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

interface JsonNode {
  type: string;
  props: Record<string, unknown>;
  children: (JsonNode | string)[] | null;
}

/** Finds the native refresh control in the rendered tree (the test mock drops testID). */
function findRefreshControl(node: JsonNode | string | null): JsonNode | undefined {
  if (!node || typeof node === 'string') return undefined;
  if (node.type === 'RCTRefreshControl' || node.type === 'AndroidSwipeRefreshLayout') return node;
  for (const child of node.children ?? []) {
    const hit = findRefreshControl(child);
    if (hit) return hit;
  }
  return undefined;
}

describe('pull to refresh', () => {
  beforeEach(() => {
    jest.mocked(pushNow).mockClear();
    jest.mocked(fetchLatestUpdate).mockClear();
  });

  it('syncs with the cloud, checks for an update and stops the spinner', async () => {
    const { result } = await renderHook(() => usePullToRefresh());
    expect(result.current.refreshing).toBe(false);
    await act(async () => {
      await result.current.onRefresh();
    });
    expect(pushNow).toHaveBeenCalledTimes(1);
    expect(fetchLatestUpdate).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(false);
  });

  it.each([
    ['tab screens', <Screen key="s" title="Resumo"><Text>conteúdo</Text></Screen>],
    ['form screens', <FormScreen key="f"><Text>conteúdo</Text></FormScreen>],
  ])('is available on %s', async (_name, element) => {
    await render(element);
    const control = findRefreshControl(screen.toJSON() as JsonNode);
    expect(control).toBeDefined();
  });
});
