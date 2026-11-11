import { computeBudget } from '../budget';
import { cycleFor } from '../cycle';
import { cycleHistory, savingsTotal } from '../history';
import { makeCard, makeCategory, makeData, makeExpense, makeFixedBill, makeIncome } from '@/test-utils/factories';

describe('computeBudget', () => {
  const data = makeData({
    settings: { salary: 200000, cycleStartDay: 1, startedAt: '2026-08-01' },
    categories: [
      makeCategory({ id: 'uber', limitType: 'percent', limitValue: 20 }),
      makeCategory({ id: 'lazer', limitType: 'amount', limitValue: 30000 }),
    ],
    fixedBills: [makeFixedBill({ id: 'aluguel', amount: 100000 })],
    expenses: [makeExpense({ id: 'u', amount: 12000, date: '2026-11-02', categoryId: 'uber' })],
  });
  const budget = computeBudget(data, cycleFor('2026-11-06', 1), '2026-11-06');

  it('splits salary into fixed bills and free money', () => {
    expect([budget.free, budget.allocated, budget.unallocated]).toEqual([100000, 50000, 50000]);
  });

  it('computes percentage limits from the free amount', () => {
    expect(budget.categories[0].limit).toBe(20000);
  });

  it('flags a category spending faster than the month pace', () => {
    const uber = budget.categories[0];
    expect(uber.spent).toBe(12000);
    expect(uber.expected).toBe(4000);
    expect(uber.health).toBe('attention');
  });

  it('flags categories over the limit', () => {
    const over = computeBudget(
      { ...data, expenses: [makeExpense({ id: 'x', amount: 35000, date: '2026-11-02', categoryId: 'lazer' })] },
      cycleFor('2026-11-06', 1),
      '2026-11-06',
    );
    expect(over.categories[1].health).toBe('over');
  });

  it('adds extra income to the budget or straight to savings', () => {
    const withIncome = computeBudget(
      {
        ...data,
        incomes: [
          makeIncome({ id: 'freela', amount: 20000, date: '2026-11-04' }),
          makeIncome({ id: 'vr', amount: 50000, date: '2026-10-01', recurrence: 'monthly', destination: 'savings' }),
        ],
      },
      cycleFor('2026-11-06', 1),
      '2026-11-06',
    );
    expect(withIncome.extraIncome).toBe(20000);
    expect(withIncome.directSavings).toBe(50000);
    expect(withIncome.free).toBe(120000);
  });
});

describe('cycleHistory / savings', () => {
  const data = makeData({
    settings: { salary: 200000, cycleStartDay: 1, startedAt: '2026-09-15' },
    categories: [makeCategory({ id: 'd', limitType: 'percent', limitValue: 50 })],
    fixedBills: [makeFixedBill({ id: 'f', amount: 100000 })],
    expenses: [makeExpense({ id: 'e', amount: 30000, date: '2026-10-05', categoryId: 'd' })],
    snapshots: [
      { start: '2026-09-01', end: '2026-09-30', salary: 150000, fixed: 100000, categories: [], closedAt: '2026-10-01' },
    ],
  });

  it('uses snapshots for closed cycles and live data otherwise', () => {
    const history = cycleHistory(data, '2026-11-03');
    expect(history.map((h) => [h.cycle.start, h.budget.free, h.saved])).toEqual([
      ['2026-09-01', 50000, 50000],
      ['2026-10-01', 100000, 70000],
      ['2026-11-01', 100000, 0],
    ]);
  });

  it('sums leftovers of closed cycles into savings', () => {
    expect(savingsTotal(cycleHistory(data, '2026-11-03'))).toBe(120000);
  });
});

describe('card purchases and budget cycles', () => {
  // Card closes on the 20th and is due on the 30th: a purchase on 28/10 is paid on 30/11.
  const card = makeCard({ id: 'itau', closingDay: 20, dueDay: 30 });
  const base = makeData({
    settings: { salary: 300000, cycleStartDay: 1, startedAt: '2026-08-01' },
    categories: [makeCategory({ id: 'almoco', limitValue: 60000 })],
    cards: [card],
    expenses: [
      makeExpense({ id: 'card', amount: 3000, date: '2026-10-28', categoryId: 'almoco', payment: { kind: 'credit', cardId: 'itau' } }),
      makeExpense({ id: 'pix', amount: 1000, date: '2026-10-28', categoryId: 'almoco' }),
    ],
  });
  const spentIn = (data: typeof base, date: string) => computeBudget(data, cycleFor(date, 1), date).spent;

  it('counts card purchases in the cycle where the invoice is due (default)', () => {
    expect(spentIn(base, '2026-10-29')).toBe(1000); // only the Pix in October
    expect(spentIn(base, '2026-11-05')).toBe(3000); // the card lunch is paid in November
  });

  it('can count card purchases on the purchase date instead', () => {
    const byPurchase = { ...base, settings: { ...base.settings, cardBudgetBasis: 'purchase' as const } };
    expect(spentIn(byPurchase, '2026-10-29')).toBe(4000);
    expect(spentIn(byPurchase, '2026-11-05')).toBe(0);
  });

  it('spreads installments over the cycles of each invoice', () => {
    const tv = makeExpense({
      id: 'tv',
      amount: 30000,
      date: '2026-10-28',
      categoryId: 'almoco',
      payment: { kind: 'credit', cardId: 'itau' },
      installments: 3,
    });
    const data = { ...base, expenses: [tv] };
    expect(['2026-10-29', '2026-11-05', '2026-12-05', '2027-01-05', '2027-02-05'].map((d) => spentIn(data, d))).toEqual([
      0, 10000, 10000, 10000, 0,
    ]);
  });
});
