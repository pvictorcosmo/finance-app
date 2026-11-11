import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Stamps, SyncDoc } from '@/domain/sync';

export type SyncStatus = 'off' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error';

interface SyncState {
  /** Local changes not yet confirmed by the cloud, by "collection/id" (persisted). */
  outbox: Record<string, SyncDoc>;
  /** Last known `updatedAt` of each document on the cloud (persisted). */
  stamps: Stamps;
  /** User whose data this device has already merged with the cloud (persisted). */
  syncedUid: string | null;
  /** Last successful sync (persisted). */
  lastSyncAt: string | null;
  /** Current status, shown in the UI (not persisted). */
  status: SyncStatus;
  /** Signed-in e-mail, when any (not persisted; restored by Firebase Auth). */
  email: string | null;
  /** Last error message in pt-BR (not persisted). */
  error: string | null;
}

/**
 * Bookkeeping for cloud sync, kept apart from the finance data so syncing never
 * changes what the app shows by itself.
 */
export const useSyncStore = create<SyncState>()(
  persist(
    (): SyncState => ({
      outbox: {},
      stamps: {},
      syncedUid: null,
      lastSyncAt: null,
      status: 'off',
      email: null,
      error: null,
    }),
    {
      name: 'finance-app/sync',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ outbox, stamps, syncedUid, lastSyncAt }) => ({ outbox, stamps, syncedUid, lastSyncAt }),
    },
  ),
);

/**
 * Adds local changes to the outbox; a newer change to the same document replaces the older one.
 * @param docs Changed documents.
 */
export function enqueue(docs: SyncDoc[]) {
  if (!docs.length) return;
  useSyncStore.setState((s) => {
    const outbox = { ...s.outbox };
    for (const doc of docs) outbox[`${doc.collection}/${doc.id}`] = doc;
    return { outbox };
  });
}

/** Number of local changes still waiting to reach the cloud. */
export function usePendingCount(): number {
  return useSyncStore((s) => Object.keys(s.outbox).length);
}
