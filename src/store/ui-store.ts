import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { formatBRL, formatBRLShort } from '@/domain/money';
import type { Cents } from '@/domain/types';

interface UiState {
  /** Hide money values on screen (the "eye" toggle). */
  hideValues: boolean;
  toggleHideValues: () => void;
}

/** Per-device UI preferences (not synced: hiding values is about this screen). */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      hideValues: false,
      toggleHideValues: () => set((s) => ({ hideValues: !s.hideValues })),
    }),
    {
      name: 'finance-app/ui',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hideValues }) => ({ hideValues }),
    },
  ),
);

/** Mask shown instead of a value while values are hidden. */
export const HIDDEN_VALUE = 'R$ ••••';

/**
 * Money formatter that respects the "hide values" toggle.
 * @returns `money(cents)` (with cents) and `moneyShort(cents)` (rounded).
 */
export function useMoney() {
  const hidden = useUiStore((s) => s.hideValues);
  const money = useCallback((cents: Cents) => (hidden ? HIDDEN_VALUE : formatBRL(cents)), [hidden]);
  const moneyShort = useCallback((cents: Cents) => (hidden ? HIDDEN_VALUE : formatBRLShort(cents)), [hidden]);
  return { money, moneyShort, hidden };
}
