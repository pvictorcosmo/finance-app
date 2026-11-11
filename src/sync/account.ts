import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';

import { stopSync } from './engine';
import { getFirebase } from './firebase';
import { useSyncStore } from './sync-store';

/** Error with a message ready to show to the user (pt-BR). */
export class AccountError extends Error {}

function translate(error: unknown): AccountError {
  const code = (error as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/missing-password': 'Digite a senha.',
    'auth/weak-password': 'Senha fraca: use pelo menos 6 caracteres.',
    'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Use "Entrar".',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/network-request-failed': 'Sem conexão com a internet.',
  };
  return new AccountError(messages[code] ?? 'Não foi possível concluir. Tente novamente.');
}

function services() {
  const fb = getFirebase();
  if (!fb) throw new AccountError('A nuvem ainda não foi configurada neste app.');
  return fb;
}

/**
 * Signs in with e-mail and password. The session is persisted, so this is needed
 * only once per device.
 * @throws {AccountError} With a pt-BR message.
 */
export async function signIn(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(services().auth, email.trim(), password);
  } catch (error) {
    throw error instanceof AccountError ? error : translate(error);
  }
}

/**
 * Creates an account and signs in; the device data is uploaded on the first sync.
 * @throws {AccountError} With a pt-BR message.
 */
export async function signUp(email: string, password: string): Promise<void> {
  try {
    await createUserWithEmailAndPassword(services().auth, email.trim(), password);
  } catch (error) {
    throw error instanceof AccountError ? error : translate(error);
  }
}

/**
 * Sends a password reset e-mail.
 * @throws {AccountError} With a pt-BR message.
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(services().auth, email.trim());
  } catch (error) {
    throw error instanceof AccountError ? error : translate(error);
  }
}

/**
 * Signs out and stops syncing. Local data stays on the device; the next sign-in
 * merges it with the cloud again.
 */
export async function signOut(): Promise<void> {
  stopSync();
  useSyncStore.setState({ syncedUid: null, outbox: {}, stamps: {}, status: 'off', email: null, error: null });
  const fb = getFirebase();
  if (fb) await firebaseSignOut(fb.auth);
}
