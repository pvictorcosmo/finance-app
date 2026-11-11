import { collection, doc, getDocs, onSnapshot, writeBatch, type Firestore } from 'firebase/firestore';

import {
  allDocs,
  applyRemote,
  dataFromDocs,
  diffData,
  docKey,
  ENTITY_COLLECTIONS,
  isPristine,
  SINGLETONS,
  SNAPSHOTS,
  toFirestoreValue,
  type SyncCollection,
  type SyncDoc,
} from '@/domain/sync';
import type { FinanceData } from '@/domain/types';
import { useFinance } from '@/store/finance-store';

import { getFirebase } from './firebase';
import { enqueue, useSyncStore } from './sync-store';

const COLLECTIONS: SyncCollection[] = [...ENTITY_COLLECTIONS, ...SINGLETONS, SNAPSHOTS];
/** Firestore allows up to 500 writes per batch. */
const BATCH_SIZE = 400;
/** Waits for a burst of edits to settle before pushing. */
const PUSH_DEBOUNCE_MS = 1500;

let stopFns: (() => void)[] = [];
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let currentUid: string | null = null;
let pushing: Promise<void> | null = null;

const now = () => new Date().toISOString();

/** Path of a user's collection: users/{uid}/{collection}. */
const userCollection = (db: Firestore, uid: string, name: SyncCollection) => collection(db, 'users', uid, name);

/** Applies a change coming from the cloud without echoing it back to the outbox. */
function setDataFromRemote(data: FinanceData) {
  applyingRemote = true;
  try {
    useFinance.setState(data);
  } finally {
    applyingRemote = false;
  }
}

function toSyncDoc(name: SyncCollection, id: string, raw: Record<string, unknown>): SyncDoc {
  return {
    collection: name,
    id,
    updatedAt: String(raw.updatedAt ?? ''),
    deleted: raw.deleted === true,
    data: raw.data ?? undefined,
  };
}

function friendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return 'Sem permissão no Firebase. Confira as regras do Firestore.';
  if (code === 'unavailable') return 'Sem conexão. As mudanças serão enviadas quando a internet voltar.';
  return 'Não foi possível sincronizar agora. Tentaremos de novo em instantes.';
}

/** Merges remote documents into the local data and records their timestamps. */
function mergeRemote(docs: SyncDoc[]) {
  if (!docs.length) return;
  const { stamps } = useSyncStore.getState();
  const local = useFinance.getState();
  const { data, applied } = applyRemote(local, docs, stamps);
  if (data !== local) setDataFromRemote(data);
  const seen = Object.fromEntries(docs.map((d) => [docKey(d.collection, d.id), d.updatedAt]));
  useSyncStore.setState((s) => ({ stamps: { ...s.stamps, ...seen, ...applied } }));
}

/**
 * Sends the outbox to Firestore. Changes older than what the cloud already has are
 * dropped (last write wins); confirmed changes leave the outbox.
 */
export function pushNow(): Promise<void> {
  if (pushing) return pushing;
  pushing = (async () => {
    const fb = getFirebase();
    const uid = currentUid;
    if (!fb || !uid) return;
    const { outbox, stamps } = useSyncStore.getState();
    const entries = Object.entries(outbox);
    if (!entries.length) {
      useSyncStore.setState({ status: 'synced', error: null, lastSyncAt: now() });
      return;
    }
    useSyncStore.setState({ status: 'syncing' });
    const toSend = entries.filter(([key, d]) => !(stamps[key] && stamps[key] > d.updatedAt));
    try {
      for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
        const batch = writeBatch(fb.db);
        for (const [, d] of toSend.slice(i, i + BATCH_SIZE)) {
          batch.set(doc(userCollection(fb.db, uid, d.collection), d.id), {
            updatedAt: d.updatedAt,
            deleted: d.deleted === true,
            data: d.deleted ? null : (toFirestoreValue(d.data) ?? null),
          });
        }
        await batch.commit();
      }
      // Remove what was sent, unless it changed again while sending.
      useSyncStore.setState((s) => {
        const next = { ...s.outbox };
        const sentStamps: Record<string, string> = {};
        for (const [key, d] of entries) {
          if (next[key] === d) delete next[key];
          sentStamps[key] = d.updatedAt;
        }
        return {
          outbox: next,
          stamps: { ...s.stamps, ...sentStamps },
          status: 'synced',
          error: null,
          lastSyncAt: now(),
        };
      });
    } catch (error) {
      const offline = (error as { code?: string })?.code === 'unavailable';
      useSyncStore.setState({ status: offline ? 'offline' : 'error', error: friendlyError(error) });
    }
  })().finally(() => {
    pushing = null;
  });
  return pushing;
}

/** Resolves once the persisted sync bookkeeping is loaded (or after 3 s, as a safety net). */
function waitForSyncStore(): Promise<void> {
  if (useSyncStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    const unsubscribe = useSyncStore.persist.onFinishHydration(() => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    });
  });
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushNow(), PUSH_DEBOUNCE_MS);
}

/**
 * First sync of this device for this user: if the cloud is empty, upload everything;
 * if this device is a fresh install, adopt the cloud copy; otherwise merge both.
 */
async function initialSync(db: Firestore, uid: string) {
  const { syncedUid } = useSyncStore.getState();
  if (syncedUid === uid) return;

  const snapshots = await Promise.all(COLLECTIONS.map((name) => getDocs(userCollection(db, uid, name))));
  const remote = snapshots.flatMap((snap, i) =>
    snap.docs.map((d) => toSyncDoc(COLLECTIONS[i], d.id, d.data() as Record<string, unknown>)),
  );
  const local = useFinance.getState();
  const stamps = Object.fromEntries(remote.map((d) => [docKey(d.collection, d.id), d.updatedAt]));

  if (!remote.length) {
    useSyncStore.setState({ stamps: {} });
    enqueue(allDocs(local, now()));
  } else if (isPristine(local)) {
    setDataFromRemote(dataFromDocs(remote, local));
    useSyncStore.setState({ stamps, outbox: {} });
  } else {
    const { data } = applyRemote(local, remote, {});
    if (data !== local) setDataFromRemote(data);
    useSyncStore.setState({ stamps });
    // Everything local that is newer than (or missing from) the cloud goes up; pushNow skips the rest.
    enqueue(allDocs(useFinance.getState(), now()).filter((d) => !(stamps[docKey(d.collection, d.id)] >= d.updatedAt)));
  }
  useSyncStore.setState({ syncedUid: uid });
}

/**
 * Starts syncing the signed-in user's data: local changes go to the outbox and are
 * pushed, and cloud changes are merged as they happen.
 * @param uid Firebase user id.
 */
export async function startSync(uid: string): Promise<void> {
  stopSync();
  const fb = getFirebase();
  if (!fb) return;
  currentUid = uid;
  // The outbox and "already synced" marker live in persisted storage: wait for them.
  await waitForSyncStore();
  if (currentUid !== uid) return;
  useSyncStore.setState({ status: 'connecting', error: null });

  // Local edits -> outbox.
  stopFns.push(
    useFinance.subscribe((state, prev) => {
      if (applyingRemote) return;
      const docs = diffData(prev, state, now());
      if (docs.length) {
        enqueue(docs);
        schedulePush();
      }
    }),
  );

  try {
    await initialSync(fb.db, uid);
  } catch (error) {
    useSyncStore.setState({ status: 'error', error: friendlyError(error) });
    return;
  }
  if (currentUid !== uid) return; // signed out meanwhile

  // Cloud edits (from other devices) -> local data.
  for (const name of COLLECTIONS) {
    stopFns.push(
      onSnapshot(
        userCollection(fb.db, uid, name),
        (snap) => {
          const docs = snap
            .docChanges()
            .filter((c) => c.type !== 'removed' && !c.doc.metadata.hasPendingWrites)
            .map((c) => toSyncDoc(name, c.doc.id, c.doc.data() as Record<string, unknown>));
          mergeRemote(docs);
        },
        (error) => useSyncStore.setState({ status: 'error', error: friendlyError(error) }),
      ),
    );
  }
  await pushNow();
}

/** Stops listening and pushing (sign-out). The local data stays on the device. */
export function stopSync() {
  stopFns.forEach((stop) => stop());
  stopFns = [];
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  currentUid = null;
}
