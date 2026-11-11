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
export const firebaseConfig: FirebaseOptions | null = null;
