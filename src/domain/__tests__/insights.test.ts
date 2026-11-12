import { categoryBreakdown } from '../breakdown';
import { computeBudget } from '../budget';
import { budgetDate } from '../charges';
import { cycleFor, shiftCycle } from '../cycle';
import { addDays } from '../dates';
import { buildInsights } from '../insights';
import type { Expense, FinanceData } from '../types';
import { makeCategory, makeData, makeExpense } from '@/test-utils/factories';

const today = '2026-11-10'; // day 10 of a 30-day cycle (1–30 Nov)

function setup(expenses: Expense[]): { data: FinanceData; insights: ReturnType<typeof buildInsights> } {
  const data = makeData({
    settings: { salary: 300000, cycleStartDay: 1, startedAt: '2026-01-01' },
    categories: [
      makeCategory({ id: 'dia', name: 'Dia a dia', limitType: 'amount', limitValue: 60000 }),
      makeCategory({ id: 'uber', name: 'Uber', limitType: 'amount', limitValue: 20000 }),
      makeCategory({ id: 'lazer', name: 'Lazer', limitType: 'amount', limitValue: 50000 }),
    ],
    expenses,
  });
  const cycle = cycleFor(today, 1);
  const budget = computeBudget(data, cycle, today);
  const prev = shiftCycle(cycle, 1, -1);
  const previous = computeBudget(data, prev, today).charges.filter((c) => budgetDate(c) <= addDays(prev.start, 9));
  const breakdown = categoryBreakdown(budget.charges, previous, data.categories);
  return { data, insights: buildInsights(budget, breakdown, cycle, today, undefined, 10) };
}

describe('buildInsights', () => {
  it('warns about categories over the limit first', () => {
    const { insights } = setup([makeExpense({ id: '1', amount: 25000, date: '2026-11-02', categoryId: 'uber' })]);
    expect(insights[0]).toEqual({ id: 'over-uber', tone: 'danger', text: 'Uber já passou R$ 50,00 do limite.' });
  });

  it('predicts the day a category runs out at the current pace', () => {
    // 30 000 in 10 days = 3 000/day -> the 60 000 limit ends on day 20.
    const { insights } = setup([makeExpense({ id: '1', amount: 30000, date: '2026-11-05', categoryId: 'dia' })]);
    expect(insights).toContainEqual({ id: 'pace-dia', tone: 'warning', text: 'No ritmo atual, Dia a dia estoura dia 20/11.' });
  });

  it('praises a drop and points out a rise versus the previous cycle', () => {
    const { insights } = setup([
      makeExpense({ id: 'p1', amount: 20000, date: '2026-10-03', categoryId: 'lazer' }),
      makeExpense({ id: 'p2', amount: 5000, date: '2026-10-04', categoryId: 'uber' }),
      makeExpense({ id: 'n1', amount: 5000, date: '2026-11-03', categoryId: 'lazer' }),
      makeExpense({ id: 'n2', amount: 12000, date: '2026-11-04', categoryId: 'uber' }),
    ]);
    expect(insights).toContainEqual({
      id: 'drop-lazer',
      tone: 'success',
      text: 'Você gastou 75% a menos com Lazer que no ciclo anterior até hoje 👏',
    });
    expect(insights).toContainEqual({
      id: 'rise-uber',
      tone: 'accent',
      text: 'Você gastou 140% a mais com Uber que no ciclo anterior até hoje.',
    });
  });

  it('shows the expected leftover when the month is on track', () => {
    const { insights } = setup([makeExpense({ id: '1', amount: 10000, date: '2026-11-05', categoryId: 'dia' })]);
    // 10 000 in 1/3 of the cycle -> ~30 000 by the end; 300 000 free -> 270 000 left.
    expect(insights).toContainEqual({ id: 'leftover', tone: 'success', text: 'No ritmo atual, sobram cerca de R$ 2.700,00 no fim do ciclo.' });
  });

  it('stays quiet in the first days of the cycle', () => {
    const data = makeData({ categories: [makeCategory({ id: 'dia', name: 'Dia a dia', limitType: 'amount', limitValue: 1000 })] });
    const cycle = cycleFor('2026-11-01', 1);
    const budget = computeBudget(
      { ...data, expenses: [makeExpense({ id: '1', amount: 500, date: '2026-11-01', categoryId: 'dia' })] },
      cycle,
      '2026-11-01',
    );
    expect(buildInsights(budget, categoryBreakdown(budget.charges, [], data.categories), cycle, '2026-11-01')).toEqual([]);
  });

  it('orders by urgency and skips the leftover when something is over', () => {
    const { insights } = setup([
      makeExpense({ id: '1', amount: 25000, date: '2026-11-02', categoryId: 'uber' }),
      makeExpense({ id: '2', amount: 30000, date: '2026-11-05', categoryId: 'dia' }),
      makeExpense({ id: '3', amount: 30000, date: '2026-11-05', categoryId: 'lazer' }),
    ]);
    // Dia a dia runs out on day 20, Lazer on day 17: the earliest comes first.
    expect(insights.map((i) => i.id)).toEqual(['over-uber', 'pace-lazer', 'pace-dia']);
  });
});
