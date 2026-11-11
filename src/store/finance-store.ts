import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { SERIES_COLORS } from '@/constants/series-colors';
import { livePlan } from '@/domain/budget';
import { cycleFor, shiftCycle } from '@/domain/cycle';
import { todayISO } from '@/domain/dates';
import { DATA_VERSION, migrateData } from '@/domain/migrate';
import type {
  AiModel,
  CardBudgetBasis,
  Agreement,
  Category,
  CreditCard,
  CycleSnapshot,
  DailySummarySettings,
  Entity,
  Expense,
  FinanceData,
  FixedBill,
  ID,
  Income,
  ISODate,
  Receivable,
} from '@/domain/types';

/**
 * Estado global do app, salvo no aparelho (AsyncStorage).
 * Para sincronizar com a nuvem no futuro, basta trocar/estender o `storage`
 * abaixo — as telas só falam com este store.
 */

type Draft<T> = Omit<T, keyof Entity> & { id?: ID };

interface FinanceActions {
  setSalary: (cents: number) => void;
  setCycleStartDay: (day: number) => void;
  setDailySummary: (settings: Partial<DailySummarySettings>) => void;
  /** Registra que um backup foi exportado agora. */
  markBackupExported: (at: string) => void;
  /** Chooses the Claude model used by the AI features. */
  setAiModel: (model: AiModel) => void;
  /** Chooses whether card purchases count on the invoice due date or the purchase date. */
  setCardBudgetBasis: (basis: CardBudgetBasis) => void;
  /** Substitui todos os dados (importar backup). */
  replaceAll: (data: FinanceData) => void;
  saveCategory: (draft: Draft<Category>) => void;
  deleteCategory: (id: ID) => void;
  saveFixedBill: (draft: Draft<FixedBill>) => void;
  deleteFixedBill: (id: ID) => void;
  saveCard: (draft: Draft<CreditCard>) => void;
  deleteCard: (id: ID) => void;
  /** Saves an expense and returns its id (used for "undo"). */
  saveExpense: (draft: Draft<Expense>) => ID;
  /** Saves many expenses at once (bank import). */
  addExpenses: (drafts: Draft<Expense>[]) => void;
  deleteExpense: (id: ID) => void;
  saveIncome: (draft: Draft<Income>) => void;
  deleteIncome: (id: ID) => void;
  saveReceivable: (draft: Draft<Receivable>) => void;
  deleteReceivable: (id: ID) => void;
  /** Marca/desmarca uma parcela de um devedor como recebida. */
  toggleReceived: (id: ID, index: number, date: ISODate) => void;
  saveAgreement: (draft: Draft<Agreement>) => void;
  deleteAgreement: (id: ID) => void;
  /** Marca/desmarca o mês `date` de um acordo como acertado. */
  toggleAgreementSettled: (id: ID, date: ISODate, settledOn: ISODate) => void;
  toggleFixedPaid: (cycleStart: ISODate, billId: ID) => void;
  toggleInvoicePaid: (cardId: ID, due: ISODate) => void;
  /** Salva a "foto" dos ciclos que já terminaram (para histórico e poupança). */
  closeCycles: (today: ISODate) => void;
}

export type FinanceState = FinanceData & FinanceActions;

/** Padrão do resumo diário: desligado até você permitir, às 20h. */
export const DEFAULT_DAILY_SUMMARY: DailySummarySettings = { enabled: false, hour: 20, minute: 0 };

export const CATEGORY_COLORS: readonly string[] = SERIES_COLORS;

export function newId(): ID {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const nowStamp = () => new Date().toISOString();

/**
 * Inserts or updates an entity by id, stamping createdAt/updatedAt.
 * @param id Id to use when inserting (defaults to a new one).
 */
function upsert<T extends Entity>(list: T[], draft: Draft<T>, id: ID = draft.id ?? newId()): T[] {
  const now = nowStamp();
  const existing = list.find((x) => x.id === id);
  if (existing) {
    return list.map((x) => (x.id === existing.id ? ({ ...existing, ...draft, id, updatedAt: now } as T) : x));
  }
  return [...list, { ...draft, id, createdAt: now, updatedAt: now } as T];
}

function toggleIn<T>(list: T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function seed(): FinanceData {
  const now = nowStamp();
  const cat = (name: string, color: string, percent: number): Category => ({
    id: newId(),
    name,
    color,
    limitType: 'percent',
    limitValue: percent,
    createdAt: now,
    updatedAt: now,
  });
  return {
    settings: { salary: 0, cycleStartDay: 1, startedAt: todayISO() },
    categories: [
      cat('Dia a dia', SERIES_COLORS[0], 40),
      cat('Lazer', SERIES_COLORS[6], 20),
      cat('Almoço', SERIES_COLORS[1], 25),
      cat('Uber', SERIES_COLORS[2], 15),
    ],
    fixedBills: [],
    cards: [],
    expenses: [],
    incomes: [],
    receivables: [],
    agreements: [],
    fixedPaid: {},
    invoicePaid: {},
    snapshots: [],
  };
}

export const useFinance = create<FinanceState>()(
  persist(
    (set, get) => ({
      ...seed(),

      setSalary: (salary) => set((s) => ({ settings: { ...s.settings, salary } })),
      setCycleStartDay: (cycleStartDay) => set((s) => ({ settings: { ...s.settings, cycleStartDay } })),
      setAiModel: (aiModel) => set((s) => ({ settings: { ...s.settings, aiModel } })),
      setCardBudgetBasis: (cardBudgetBasis) => set((s) => ({ settings: { ...s.settings, cardBudgetBasis } })),
      markBackupExported: (at) => set((s) => ({ settings: { ...s.settings, lastBackupAt: at } })),
      replaceAll: (data) =>
        set({
          settings: data.settings,
          categories: data.categories,
          fixedBills: data.fixedBills,
          cards: data.cards,
          expenses: data.expenses,
          incomes: data.incomes,
          receivables: data.receivables,
          agreements: data.agreements,
          fixedPaid: data.fixedPaid ?? {},
          invoicePaid: data.invoicePaid ?? {},
          snapshots: data.snapshots ?? [],
        }),
      setDailySummary: (patch) =>
        set((s) => ({
          settings: { ...s.settings, dailySummary: { ...DEFAULT_DAILY_SUMMARY, ...s.settings.dailySummary, ...patch } },
        })),

      saveCategory: (draft) => set((s) => ({ categories: upsert(s.categories, draft) })),
      deleteCategory: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      saveFixedBill: (draft) => set((s) => ({ fixedBills: upsert(s.fixedBills, draft) })),
      deleteFixedBill: (id) => set((s) => ({ fixedBills: s.fixedBills.filter((b) => b.id !== id) })),

      saveCard: (draft) => set((s) => ({ cards: upsert(s.cards, draft) })),
      deleteCard: (id) => set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),

      saveExpense: (draft) => {
        const id = draft.id ?? newId();
        set((s) => ({ expenses: upsert(s.expenses, draft, id) }));
        return id;
      },
      addExpenses: (drafts) =>
        set((s) => ({ expenses: drafts.reduce((list, d) => upsert(list, d), s.expenses) })),
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      saveIncome: (draft) => set((s) => ({ incomes: upsert(s.incomes, draft) })),
      deleteIncome: (id) => set((s) => ({ incomes: s.incomes.filter((i) => i.id !== id) })),

      saveReceivable: (draft) => set((s) => ({ receivables: upsert(s.receivables, draft) })),
      deleteReceivable: (id) => set((s) => ({ receivables: s.receivables.filter((r) => r.id !== id) })),
      toggleReceived: (id, index, date) =>
        set((s) => ({
          receivables: s.receivables.map((r) => {
            if (r.id !== id) return r;
            const received = { ...r.received };
            if (received[index]) delete received[index];
            else received[index] = date;
            return { ...r, received, updatedAt: nowStamp() };
          }),
        })),

      saveAgreement: (draft) => set((s) => ({ agreements: upsert(s.agreements, draft) })),
      deleteAgreement: (id) => set((s) => ({ agreements: s.agreements.filter((a) => a.id !== id) })),
      toggleAgreementSettled: (id, date, settledOn) =>
        set((s) => ({
          agreements: s.agreements.map((a) => {
            if (a.id !== id) return a;
            const settled = { ...a.settled };
            if (settled[date]) delete settled[date];
            else settled[date] = settledOn;
            return { ...a, settled, updatedAt: nowStamp() };
          }),
        })),

      toggleFixedPaid: (cycleStart, billId) =>
        set((s) => ({ fixedPaid: { ...s.fixedPaid, [cycleStart]: toggleIn(s.fixedPaid[cycleStart], billId) } })),
      toggleInvoicePaid: (cardId, due) =>
        set((s) => ({ invoicePaid: { ...s.invoicePaid, [cardId]: toggleIn(s.invoicePaid[cardId], due) } })),

      closeCycles: (today) => {
        const s = get();
        const startDay = s.settings.cycleStartDay;
        const have = new Set(s.snapshots.map((x) => x.start));
        const plan = livePlan(s);
        const added: CycleSnapshot[] = [];
        let c = cycleFor(s.settings.startedAt, startDay);
        for (let i = 0; c.end < today && i < 120; i++, c = shiftCycle(c, startDay, 1)) {
          if (have.has(c.start)) continue;
          added.push({
            start: c.start,
            end: c.end,
            salary: plan.salary,
            fixed: plan.fixed,
            categories: plan.categories,
            closedAt: nowStamp(),
          });
        }
        if (added.length) set({ snapshots: [...s.snapshots, ...added] });
      },
    }),
    {
      name: 'finance-app/data',
      version: DATA_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): FinanceData => ({
        settings: s.settings,
        categories: s.categories,
        fixedBills: s.fixedBills,
        cards: s.cards,
        expenses: s.expenses,
        incomes: s.incomes,
        receivables: s.receivables,
        agreements: s.agreements,
        fixedPaid: s.fixedPaid,
        invoicePaid: s.invoicePaid,
        snapshots: s.snapshots,
      }),
      migrate: (persisted, version) => migrateData(persisted, version),
      // zustand never reports "hydrated" when loading fails; record the error so the UI can show it.
      onRehydrateStorage: () => (_state, error) => {
        setHydrationError(error ?? null);
      },
    },
  ),
);

/** Dados puros (sem as ações), para passar às funções de domínio. */
export function useFinanceData(): FinanceData {
  const settings = useFinance((s) => s.settings);
  const categories = useFinance((s) => s.categories);
  const fixedBills = useFinance((s) => s.fixedBills);
  const cards = useFinance((s) => s.cards);
  const expenses = useFinance((s) => s.expenses);
  const incomes = useFinance((s) => s.incomes);
  const receivables = useFinance((s) => s.receivables);
  const agreements = useFinance((s) => s.agreements);
  const fixedPaid = useFinance((s) => s.fixedPaid);
  const invoicePaid = useFinance((s) => s.invoicePaid);
  const snapshots = useFinance((s) => s.snapshots);
  return useMemo(
    () => ({
      settings,
      categories,
      fixedBills,
      cards,
      expenses,
      incomes,
      receivables,
      agreements,
      fixedPaid,
      invoicePaid,
      snapshots,
    }),
    [settings, categories, fixedBills, cards, expenses, incomes, receivables, agreements, fixedPaid, invoicePaid, snapshots],
  );
}

let hydrationError: unknown = null;
const hydrationErrorListeners = new Set<() => void>();

function setHydrationError(error: unknown) {
  hydrationError = error;
  hydrationErrorListeners.forEach((l) => l());
}

/**
 * Error raised while loading the data saved on the device, if any.
 * @returns The error, or null while loading or after a successful load.
 */
export function useHydrationError(): unknown {
  return useSyncExternalStore(
    (onChange) => {
      hydrationErrorListeners.add(onChange);
      return () => hydrationErrorListeners.delete(onChange);
    },
    () => hydrationError,
    () => null,
  );
}

/** Retries loading the data saved on the device (after a load error). */
export async function retryHydration(): Promise<void> {
  setHydrationError(null);
  await useFinance.persist.rehydrate();
}

/** true depois que os dados salvos no aparelho foram carregados. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useFinance.persist.onFinishHydration(onChange),
    () => useFinance.persist.hasHydrated(),
    () => false,
  );
}
