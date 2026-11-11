import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

/**
 * `getReactNativePersistence` exists in the React Native build of `@firebase/auth`
 * (which Metro resolves at runtime), but the package's export map always hands
 * TypeScript the web typings first. This declares the React Native export so the
 * session can be persisted with AsyncStorage (sign in once, stay signed in).
 */
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
