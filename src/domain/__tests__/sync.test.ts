import {
  allDocs,
  applyRemote,
  dataFromDocs,
  diffData,
  docKey,
  isPristine,
  toFirestoreValue,
  type Stamps,
  type SyncDoc,
} from '../sync';
import type { FinanceData } from '../types';
import { makeCategory, makeData, makeExpense } from '@/test-utils/factories';

const T1 = '2026-11-10T10:00:00.000Z';
const T2 = '2026-11-10T11:00:00.000Z';
const T3 = '2026-11-10T12:00:00.000Z';

const lunch = makeExpense({ id: 'e1', amount: 3000, date: '2026-11-10', categoryId: 'c', updatedAt: T1 });
const base = makeData({ categories: [makeCategory({ id: 'c' })], expenses: [lunch] });

describe('diffData', () => {
  it('reports added, changed and deleted entities', () => {
    const edited = { ...lunch, amount: 3500, updatedAt: T2 };
    const added = makeExpense({ id: 'e2', amount: 100, date: '2026-11-10', categoryId: 'c', updatedAt: T2 });
    const changed = diffData(base, { ...base, expenses: [edited, added] }, T3);
    expect(changed.map((d) => [d.collection, d.id, d.updatedAt, d.deleted ?? false])).toEqual([
      ['expenses', 'e1', T2, false],
      ['expenses', 'e2', T2, false],
    ]);
    const removed = diffData(base, { ...base, expenses: [] }, T3);
    expect(removed).toEqual([{ collection: 'expenses', id: 'e1', updatedAt: T3, deleted: true }]);
  });

  it('reports singletons and new snapshots', () => {
    const next: FinanceData = {
      ...base,
      settings: { ...base.settings, salary: 500000 },
      snapshots: [{ start: '2026-10-01', end: '2026-10-31', salary: 1, fixed: 0, categories: [], closedAt: T1 }],
    };
    expect(diffData(base, next, T3).map((d) => docKey(d.collection, d.id))).toEqual(['settings/main', 'snapshots/2026-10-01']);
  });

  it('ignores untouched data', () => {
    expect(diffData(base, { ...base }, T3)).toEqual([]);
  });
});

describe('applyRemote', () => {
  const remote = (doc: Partial<SyncDoc>): SyncDoc => ({ collection: 'expenses', id: 'e1', updatedAt: T2, ...doc });

  it('applies newer remote versions and ignores older ones', () => {
    const newer = applyRemote(base, [remote({ data: { ...lunch, amount: 9999, updatedAt: T2 } })], {});
    expect(newer.data.expenses[0].amount).toBe(9999);
    const older = applyRemote(base, [remote({ updatedAt: '2026-01-01T00:00:00.000Z', data: { ...lunch, amount: 1 } })], {});
    expect(older.data).toBe(base);
  });

  it('deletes on a newer tombstone but keeps a local edit made after it', () => {
    expect(applyRemote(base, [remote({ deleted: true })], {}).data.expenses).toEqual([]);
    const editedLater = { ...base, expenses: [{ ...lunch, updatedAt: T3 }] };
    expect(applyRemote(editedLater, [remote({ deleted: true })], {}).data.expenses).toHaveLength(1);
  });

  it('applies singletons only when newer than the local stamp', () => {
    const doc: SyncDoc = { collection: 'settings', id: 'main', updatedAt: T2, data: { ...base.settings, salary: 700000 } };
    expect(applyRemote(base, [doc], {}).data.settings.salary).toBe(700000);
    expect(applyRemote(base, [doc], { 'settings/main': T3 }).data).toBe(base);
  });
});

describe('first sync helpers', () => {
  it('detects a fresh install', () => {
    expect(isPristine(makeData({ categories: [makeCategory({ id: 'seed' })] }))).toBe(true);
    expect(isPristine(base)).toBe(false);
  });

  it('round-trips all data through documents', () => {
    const docs = allDocs(base, T1).map((d) => ({ ...d, data: toFirestoreValue(d.data) }));
    expect(dataFromDocs(docs, makeData())).toEqual(toFirestoreValue(base));
  });

  it('strips undefined values for Firestore', () => {
    expect(toFirestoreValue({ a: 1, b: undefined })).toEqual({ a: 1 });
  });
});

/**
 * Two devices talking through a fake cloud that applies the same last-write-wins rule
 * as the engine (a push is dropped when the cloud already has a newer version).
 */
describe('two devices', () => {
  const cloud = new Map<string, SyncDoc>();
  const push = (docs: SyncDoc[]) => {
    for (const d of docs) {
      const current = cloud.get(docKey(d.collection, d.id));
      if (!current || current.updatedAt <= d.updatedAt) cloud.set(docKey(d.collection, d.id), d);
    }
  };
  const pull = (data: FinanceData, stamps: Stamps) => applyRemote(data, [...cloud.values()], stamps).data;

  it('converges after edits and deletes on both sides', () => {
    // Phone A uploads everything; phone B starts from the cloud copy.
    let phoneA = base;
    push(allDocs(phoneA, T1));
    let phoneB = dataFromDocs([...cloud.values()], makeData());

    // A edits the lunch at T2; B deletes it later, at T3.
    const aEdited = { ...phoneA, expenses: [{ ...lunch, amount: 4200, updatedAt: T2 }] };
    push(diffData(phoneA, aEdited, T2));
    phoneA = aEdited;
    const bDeleted = { ...phoneB, expenses: [] };
    push(diffData(phoneB, bDeleted, T3));
    phoneB = bDeleted;

    // B adds a new expense; both pull.
    const coffee = makeExpense({ id: 'e9', amount: 700, date: '2026-11-10', categoryId: 'c', updatedAt: T3 });
    const bAdded = { ...phoneB, expenses: [coffee] };
    push(diffData(phoneB, bAdded, T3));
    phoneB = bAdded;

    phoneA = pull(phoneA, {});
    phoneB = pull(phoneB, {});
    expect(phoneA.expenses.map((e) => e.id)).toEqual(['e9']);
    expect(phoneB.expenses.map((e) => e.id)).toEqual(['e9']);
  });
});
