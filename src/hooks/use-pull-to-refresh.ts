import { useCallback, useState } from 'react';

import { pushNow } from '@/sync/engine';
import { fetchLatestUpdate } from '@/updates/fetch-latest';

/** Keeps the spinner visible long enough to be noticed. */
const MIN_SPINNER_MS = 600;
/** Never leave the spinner up for long (e.g. offline). */
const MAX_WAIT_MS = 8000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * What "pull to refresh" does: send pending changes to the cloud (when signed in)
 * and check for an over-the-air update. Local data is always live, so there is
 * nothing to reload from the device itself.
 */
export async function refreshApp(): Promise<void> {
  await Promise.race([Promise.allSettled([pushNow(), fetchLatestUpdate()]), wait(MAX_WAIT_MS)]);
}

/**
 * State for a `RefreshControl`.
 * @returns `refreshing` and the `onRefresh` handler.
 */
export function usePullToRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshApp(), wait(MIN_SPINNER_MS)]);
    } finally {
      setRefreshing(false);
    }
  }, []);
  return { refreshing, onRefresh };
}
