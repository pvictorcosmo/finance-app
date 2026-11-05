import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/** Storage key for the user's Anthropic API key. */
const KEY = 'anthropic-api-key';

let cached: string | null | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/**
 * Reads the API key from secure storage (Keychain / Keystore).
 * On web, where secure storage does not exist, falls back to localStorage.
 * @returns The stored key, or null when none is set.
 */
export async function getApiKey(): Promise<string | null> {
  if (cached !== undefined) return cached;
  cached = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) ?? null : await SecureStore.getItemAsync(KEY);
  emit();
  return cached;
}

/**
 * Saves (or removes, when `key` is null) the API key in secure storage.
 * @param key The Anthropic API key, or null to delete it.
 */
export async function setApiKey(key: string | null): Promise<void> {
  const value = key?.trim() || null;
  if (Platform.OS === 'web') {
    if (value) globalThis.localStorage?.setItem(KEY, value);
    else globalThis.localStorage?.removeItem(KEY);
  } else if (value) {
    await SecureStore.setItemAsync(KEY, value);
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
  cached = value;
  emit();
}

/** Masks a key for display: "sk-ant-…a1B2". */
export function maskKey(key: string): string {
  return key.length <= 12 ? '••••' : `${key.slice(0, 7)}…${key.slice(-4)}`;
}

/**
 * React hook that tells whether an API key is configured.
 * @returns `undefined` while loading, then `true`/`false`.
 */
export function useHasApiKey(): boolean | undefined {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      if (cached === undefined) void getApiKey();
      return () => listeners.delete(onChange);
    },
    () => (cached === undefined ? undefined : cached !== null),
    () => undefined,
  );
}
