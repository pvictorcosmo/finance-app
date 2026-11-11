import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { pushNow, startSync, stopSync } from './engine';
import { getFirebase } from './firebase';
import { useSyncStore } from './sync-store';

/**
 * Keeps cloud sync running while a user is signed in: starts it once the local data
 * is loaded, follows sign-in/out (the session survives restarts, so the user signs
 * in only once), and retries pending changes when the app returns to the foreground.
 * @param hydrated True once the local data has been loaded from the device.
 */
export function useCloudSync(hydrated: boolean) {
  useEffect(() => {
    const fb = getFirebase();
    if (!hydrated || !fb) return;
    const unsubscribeAuth = onAuthStateChanged(fb.auth, (user) => {
      if (user) {
        useSyncStore.setState({ email: user.email });
        void startSync(user.uid);
      } else {
        stopSync();
        useSyncStore.setState({ status: 'off', email: null });
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void pushNow();
    });
    return () => {
      unsubscribeAuth();
      appState.remove();
      stopSync();
    };
  }, [hydrated]);
}
