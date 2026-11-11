import type { Entity, FinanceData } from './types';

/**
 * Local-first sync model.
 *
 * The device store stays the source the UI reads from. Every local change becomes a
 * {@link SyncDoc} in an outbox that is pushed to the cloud; documents coming from the
 * cloud are merged back with last-write-wins on `updatedAt`. Deletions travel as
 * tombstones (`deleted: true`) so an item removed on one device does not come back
 * from another.
 */

/** Collections of entities with their own id and `updatedAt`. */
export const ENTITY_COLLECTIONS = [
  'categories',
  'fixedBills',
  'cards',
  'expenses',
  'incomes',
  'receivables',
  'agreements',
] as const;
export type EntityCollection = (typeof ENTITY_COLLECTIONS)[number];

/** Parts of the data stored as a single document each (id "main"). */
export const SINGLETONS = ['settings', 'fixedPaid', 'invoicePaid'] as const;
export type Singleton = (typeof SINGLETONS)[number];

/** Cycle snapshots, keyed by cycle start (they have no `updatedAt`, `closedAt` plays that role). */
export const SNAPSHOTS = 'snapshots';

export type SyncCollection = EntityCollection | Singleton | typeof SNAPSHOTS;

export const SINGLETON_ID = 'main';

/** A document as stored in the cloud. */
export interface SyncDoc {
  collection: SyncCollection;
  id: string;
  /** ISO timestamp used for last-write-wins. */
  updatedAt: string;
  deleted?: boolean;
  /** The entity / singleton value (absent for tombstones). */
  data?: unknown;
}

/** Outbox / remote index key: "collection/id". */
export const docKey = (collection: SyncCollection, id: string) => `${collection}/${id}`;

function byId<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((x) => [x.id, x]));
}

/**
 * Lists what changed between two versions of the local data.
 * Entities use their own `updatedAt`; singletons and deletions are stamped with `now`.
 * @param prev Data before the change.
 * @param next Data after the change.
 * @param now Timestamp for changes that carry none.
 */
export function diffData(prev: FinanceData, next: FinanceData, now: string): SyncDoc[] {
  const docs: SyncDoc[] = [];

  for (const collection of ENTITY_COLLECTIONS) {
    const before = prev[collection] as Entity[];
    const after = next[collection] as Entity[];
    if (before === after) continue;
    const old = byId(before);
    const current = byId(after);
    for (const [id, entity] of current) {
      if (old.get(id) !== entity) docs.push({ collection, id, updatedAt: entity.updatedAt, data: entity });
    }
    for (const id of old.keys()) {
      if (!current.has(id)) docs.push({ collection, id, updatedAt: now, deleted: true });
    }
  }

  for (const singleton of SINGLETONS) {
    if (prev[singleton] !== next[singleton]) {
      docs.push({ collection: singleton, id: SINGLETON_ID, updatedAt: now, data: next[singleton] });
    }
  }

  if (prev.snapshots !== next.snapshots) {
    const old = new Map(prev.snapshots.map((s) => [s.start, s]));
    for (const snap of next.snapshots) {
      if (old.get(snap.start) !== snap) {
        docs.push({ collection: SNAPSHOTS, id: snap.start, updatedAt: snap.closedAt, data: snap });
      }
    }
  }
  return docs;
}

/**
 * Every piece of local data as documents, for the first upload of a device.
 * @param data Local data.
 * @param now Timestamp for singletons.
 */
export function allDocs(data: FinanceData, now: string): SyncDoc[] {
  const empty: FinanceData = {
    settings: undefined as never,
    categories: [],
    fixedBills: [],
    cards: [],
    expenses: [],
    incomes: [],
    receivables: [],
    agreements: [],
    fixedPaid: undefined as never,
    invoicePaid: undefined as never,
    snapshots: [],
  };
  return diffData(empty, data, now);
}

/** Timestamps of the last known version of each document, used to resolve conflicts. */
export type Stamps = Record<string, string>;

/**
 * Merges documents from the cloud into the local data (last write wins).
 * @param local Current local data.
 * @param docs Remote documents.
 * @param stamps Last known `updatedAt` of local singletons/snapshots (entities carry their own).
 * @returns The merged data (same object when nothing changed) and the stamps of applied docs.
 */
export function applyRemote(
  local: FinanceData,
  docs: SyncDoc[],
  stamps: Stamps,
): { data: FinanceData; applied: Stamps } {
  let data = local;
  const applied: Stamps = {};
  const set = <K extends keyof FinanceData>(key: K, value: FinanceData[K]) => {
    data = { ...data, [key]: value };
  };

  for (const doc of docs) {
    const key = docKey(doc.collection, doc.id);
    if ((ENTITY_COLLECTIONS as readonly string[]).includes(doc.collection)) {
      const collection = doc.collection as EntityCollection;
      const list = data[collection] as Entity[];
      const current = list.find((x) => x.id === doc.id);
      // A local version that is newer (or equal) wins; it will be pushed from the outbox.
      if (current && current.updatedAt >= doc.updatedAt) continue;
      if (doc.deleted) {
        if (current) set(collection, list.filter((x) => x.id !== doc.id) as never);
      } else {
        const next = current
          ? list.map((x) => (x.id === doc.id ? (doc.data as Entity) : x))
          : [...list, doc.data as Entity];
        set(collection, next as never);
      }
      applied[key] = doc.updatedAt;
    } else if (doc.collection === SNAPSHOTS) {
      if (doc.deleted || data.snapshots.some((s) => s.start === doc.id)) continue;
      set('snapshots', [...data.snapshots, doc.data as FinanceData['snapshots'][number]]);
      applied[key] = doc.updatedAt;
    } else {
      const singleton = doc.collection as Singleton;
      if (doc.deleted || (stamps[key] && stamps[key] >= doc.updatedAt)) continue;
      set(singleton, doc.data as never);
      applied[key] = doc.updatedAt;
    }
  }
  return { data, applied };
}

/**
 * True when the device has nothing the user created yet (fresh install): on the first
 * sync its data is replaced by the cloud copy instead of merged, so the default
 * categories of a new install do not duplicate the user's.
 * @param data Local data.
 */
export function isPristine(data: FinanceData): boolean {
  return (
    data.settings.salary === 0 &&
    data.expenses.length === 0 &&
    data.cards.length === 0 &&
    data.fixedBills.length === 0 &&
    data.incomes.length === 0 &&
    data.receivables.length === 0 &&
    data.agreements.length === 0
  );
}

/**
 * Builds the full data set from a complete cloud copy (used when adopting it).
 * @param docs All remote documents.
 * @param fallback Data used for parts the cloud does not have.
 */
export function dataFromDocs(docs: SyncDoc[], fallback: FinanceData): FinanceData {
  const live = docs.filter((d) => !d.deleted);
  const pick = (collection: SyncCollection) => live.filter((d) => d.collection === collection).map((d) => d.data);
  const single = (collection: Singleton) => live.find((d) => d.collection === collection)?.data;
  return {
    settings: (single('settings') as FinanceData['settings']) ?? fallback.settings,
    categories: pick('categories') as FinanceData['categories'],
    fixedBills: pick('fixedBills') as FinanceData['fixedBills'],
    cards: pick('cards') as FinanceData['cards'],
    expenses: pick('expenses') as FinanceData['expenses'],
    incomes: pick('incomes') as FinanceData['incomes'],
    receivables: pick('receivables') as FinanceData['receivables'],
    agreements: pick('agreements') as FinanceData['agreements'],
    fixedPaid: (single('fixedPaid') as FinanceData['fixedPaid']) ?? {},
    invoicePaid: (single('invoicePaid') as FinanceData['invoicePaid']) ?? {},
    snapshots: pick(SNAPSHOTS) as FinanceData['snapshots'],
  };
}

/**
 * Removes `undefined` values (Firestore rejects them) by a JSON round trip.
 * @param value Any JSON-compatible value.
 */
export function toFirestoreValue<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
