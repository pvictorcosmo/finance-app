import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  Category,
  CreditCard,
  Expense,
  FinanceData,
  FixedBill,
  ID,
  ISODate,
} from '@/domain/types';

/**
 * Estado global do app, salvo no aparelho (AsyncStorage).
 * Para sincronizar com a nuvem no futuro, basta trocar/estender o `storage`
 * abaixo — as telas só falam com este store.
 */

type Draft<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: ID };

interface FinanceActions {
  setSalary: (cents: number) => void;
  setCycleStartDay: (day: number) => void;
  saveCategory: (draft: Draft<Category>) => void;
  deleteCategory: (id: ID) => void;
  saveFixedBill: (draft: Draft<FixedBill>) => void;
  deleteFixedBill: (id: ID) => void;
  saveCard: (draft: Draft<CreditCard>) => void;
  deleteCard: (id: ID) => void;
  saveExpense: (draft: Draft<Expense>) => void;
  deleteExpense: (id: ID) => void;
  toggleFixedPaid: (cycleStart: ISODate, billId: ID) => void;
}

export type FinanceState = FinanceData & FinanceActions;

export const CATEGORY_COLORS = [
  '#208AEF', '#30A46C', '#F76B15', '#E5484D', '#8E4EC6',
  '#D6409F', '#12A594', '#FFB224', '#6E56CF', '#5B5BD6',
];

export function newId(): ID {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const nowStamp = () => new Date().toISOString();

function upsert<T extends { id: ID; createdAt: string; updatedAt: string }>(
  list: T[],
  draft: Draft<T>,
): T[] {
  const now = nowStamp();
  const existing = draft.id ? list.find((x) => x.id === draft.id) : undefined;
  if (existing) {
    return list.map((x) => (x.id === existing.id ? ({ ...existing, ...draft, updatedAt: now } as T) : x));
  }
  return [...list, { ...draft, id: newId(), createdAt: now, updatedAt: now } as T];
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
    settings: { salary: 0, cycleStartDay: 1 },
    categories: [
      cat('Dia a dia', CATEGORY_COLORS[0], 40),
      cat('Lazer', CATEGORY_COLORS[4], 20),
      cat('Almoço', CATEGORY_COLORS[2], 25),
      cat('Uber', CATEGORY_COLORS[1], 15),
    ],
    fixedBills: [],
    cards: [],
    expenses: [],
    fixedPaid: {},
  };
}

export const useFinance = create<FinanceState>()(
  persist(
    (set) => ({
      ...seed(),

      setSalary: (salary) => set((s) => ({ settings: { ...s.settings, salary } })),
      setCycleStartDay: (cycleStartDay) => set((s) => ({ settings: { ...s.settings, cycleStartDay } })),

      saveCategory: (draft) => set((s) => ({ categories: upsert(s.categories, draft) })),
      deleteCategory: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      saveFixedBill: (draft) => set((s) => ({ fixedBills: upsert(s.fixedBills, draft) })),
      deleteFixedBill: (id) => set((s) => ({ fixedBills: s.fixedBills.filter((b) => b.id !== id) })),

      saveCard: (draft) => set((s) => ({ cards: upsert(s.cards, draft) })),
      deleteCard: (id) => set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),

      saveExpense: (draft) => set((s) => ({ expenses: upsert(s.expenses, draft) })),
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      toggleFixedPaid: (cycleStart, billId) =>
        set((s) => {
          const paid = s.fixedPaid[cycleStart] ?? [];
          const next = paid.includes(billId) ? paid.filter((id) => id !== billId) : [...paid, billId];
          return { fixedPaid: { ...s.fixedPaid, [cycleStart]: next } };
        }),
    }),
    {
      name: 'finance-app/data',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ settings, categories, fixedBills, cards, expenses, fixedPaid }): FinanceData => ({
        settings,
        categories,
        fixedBills,
        cards,
        expenses,
        fixedPaid,
      }),
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
  const fixedPaid = useFinance((s) => s.fixedPaid);
  return { settings, categories, fixedBills, cards, expenses, fixedPaid };
}

/** true depois que os dados salvos no aparelho foram carregados. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useFinance.persist.onFinishHydration(onChange),
    () => useFinance.persist.hasHydrated(),
    () => false,
  );
}
