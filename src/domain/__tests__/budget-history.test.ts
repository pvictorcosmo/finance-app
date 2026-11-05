import { computeBudget } from '../budget';
import { cycleFor } from '../cycle';
import { cycleHistory, savingsTotal } from '../history';
import { makeCategory, makeData, makeExpense, makeFixedBill, makeIncome } from '@/test-utils/factories';

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
