import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

import { firebaseConfig } from './firebase-config';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let services: FirebaseServices | null = null;

/** True when a Firebase project is configured in `firebase-config.ts`. */
export const isCloudConfigured = firebaseConfig !== null;

/**
 * Lazily initializes Firebase. Auth persists the session in AsyncStorage, so the user
 * signs in once and stays signed in across app restarts and updates.
 * @returns The services, or null when no Firebase project is configured.
 */
export function getFirebase(): FirebaseServices | null {
  if (!firebaseConfig) return null;
  if (services) return services;
  const existing = getApps().length > 0;
  const app = existing ? getApp() : initializeApp(firebaseConfig);
  // initializeAuth may only be called once per app (e.g. not again after a fast refresh).
  const auth = existing ? getAuth(app) : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  services = { app, auth, db: getFirestore(app) };
  return services;
}
