import type { FirebaseOptions } from 'firebase/app';

/**
 * Firebase web app configuration (Firebase console → Project settings → Your apps →
 * Web app → SDK setup and configuration → "Config").
 *
 * These values are public identifiers, not secrets: data access is protected by the
 * Firestore security rules in `firestore.rules` (each user can only read and write
 * their own data). While this is `null`, cloud sync stays disabled and the app keeps
 * working offline exactly as before.
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyCOXzvx-BkcGTXEVK8PDL_gp3sj41eNXtI',
  authDomain: 'finance-app-e648d.firebaseapp.com',
  projectId: 'finance-app-e648d',
  storageBucket: 'finance-app-e648d.firebasestorage.app',
  messagingSenderId: '845694924793',
  appId: '1:845694924793:web:20591cd2a9e7f8b9b76f28',
};
