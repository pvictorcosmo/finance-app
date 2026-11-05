import type {
  Agreement,
  Category,
  CreditCard,
  Expense,
  FinanceData,
  FixedBill,
  Income,
  Receivable,
} from '@/domain/types';

/** Fixed timestamp so entities created in tests are deterministic. */
export const STAMP = '2026-08-01T00:00:00.000Z';

const entity = (id: string) => ({ id, createdAt: STAMP, updatedAt: STAMP });

/** Builds a category; amounts are in cents, percentages in 0–100. */
export function makeCategory(overrides: Partial<Category> & Pick<Category, 'id'>): Category {
  return { name: overrides.id, color: '#2a78d6', limitType: 'amount', limitValue: 0, ...entity(overrides.id), ...overrides };
}

/** Builds a credit card (closes on the 3rd, due on the 10th by default). */
export function makeCard(overrides: Partial<CreditCard> & Pick<CreditCard, 'id'>): CreditCard {
  return { name: overrides.id, color: '#6250d6', closingDay: 3, dueDay: 10, ...entity(overrides.id), ...overrides };
}

/** Builds an expense paid by Pix unless `payment` is given. */
export function makeExpense(overrides: Partial<Expense> & Pick<Expense, 'id' | 'amount' | 'date' | 'categoryId'>): Expense {
  return { description: overrides.id, payment: { kind: 'pix' }, ...entity(overrides.id), ...overrides };
}

/** Builds a monthly fixed bill paid by Pix unless `payment` is given. */
export function makeFixedBill(overrides: Partial<FixedBill> & Pick<FixedBill, 'id' | 'amount'>): FixedBill {
  return { name: overrides.id, dueDay: 10, payment: { kind: 'pix' }, ...entity(overrides.id), ...overrides };
}

/** Builds a one-off extra income that goes to the budget. */
export function makeIncome(overrides: Partial<Income> & Pick<Income, 'id' | 'amount' | 'date'>): Income {
  return {
    description: overrides.id,
    kind: 'freela',
    recurrence: 'once',
    destination: 'budget',
    ...entity(overrides.id),
    ...overrides,
  };
}

/** Builds a receivable paid in one installment. */
export function makeReceivable(
  overrides: Partial<Receivable> & Pick<Receivable, 'id' | 'person' | 'amount' | 'firstDue'>,
): Receivable {
  return {
    description: 'empréstimo',
    lentDate: overrides.firstDue,
    installments: 1,
    received: {},
    ...entity(overrides.id),
    ...overrides,
  };
}

/** Builds a monthly agreement settled only by mutual offset ("só combinado"). */
export function makeAgreement(
  overrides: Partial<Agreement> & Pick<Agreement, 'id' | 'person' | 'theyPay' | 'iPay' | 'startDate'>,
): Agreement {
  return { description: 'acordo', iPayMethod: null, settled: {}, ...entity(overrides.id), ...overrides };
}

/** Builds a full data set with sensible empty defaults. */
export function makeData(overrides: Partial<FinanceData> = {}): FinanceData {
  return {
    settings: { salary: 0, cycleStartDay: 1, startedAt: '2026-08-01' },
    categories: [],
    fixedBills: [],
    cards: [],
    expenses: [],
    incomes: [],
    receivables: [],
    agreements: [],
    fixedPaid: {},
    invoicePaid: {},
    snapshots: [],
    ...overrides,
  };
}
