import { allCharges } from '../charges';
import { EMPTY_FILTERS, parseQuery, periodRange, searchCharges, type SearchFilters } from '../search';
import { makeCard, makeCategory, makeData, makeExpense } from '@/test-utils/factories';

describe('parseQuery', () => {
  it.each([
    ['ração', { terms: ['racao'] }],
    ['45,90', { terms: [], min: 4590, max: 4590 }],
    ['acima de 100', { terms: [], min: 10000 }],
    ['> 100', { terms: [], min: 10000 }],
    ['abaixo de 50', { terms: [], max: 5000 }],
    ['< 50', { terms: [], max: 5000 }],
    ['50-200', { terms: [], min: 5000, max: 20000 }],
    ['entre 50 e 200', { terms: [], min: 5000, max: 20000 }],
    ['ração acima de 100', { terms: ['racao'], min: 10000 }],
    ['uber R$ 23,90', { terms: ['uber'], min: 2390, max: 2390 }],
  ])('understands %p', (query, expected) => {
    expect(parseQuery(query)).toEqual(expected);
  });
});

describe('periodRange', () => {
  it('ends at the end of the current cycle', () => {
    expect(periodRange('cycle', '2026-11-11', 1)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(periodRange('3m', '2026-11-11', 1)).toEqual({ from: '2026-08-12', to: '2026-11-30' });
    expect(periodRange('all', '2026-11-11', 1)).toEqual({ to: '2026-11-30' });
  });
});

describe('searchCharges', () => {
  const pet = makeCategory({ id: 'pet', name: 'Pet' });
  const dia = makeCategory({ id: 'dia', name: 'Dia a dia' });
  const nu = makeCard({ id: 'nu', name: 'Nubank' });
  const data = makeData({
    settings: { salary: 500000, cycleStartDay: 1, startedAt: '2026-01-01' },
    categories: [pet, dia],
    cards: [nu],
    expenses: [
      makeExpense({ id: 'r1', description: 'Ração Golden', amount: 18990, date: '2026-09-05', categoryId: 'pet' }),
      makeExpense({ id: 'r2', description: 'Ração Golden', amount: 18990, date: '2026-10-04', categoryId: 'pet', payment: { kind: 'credit', cardId: 'nu' } }),
      makeExpense({ id: 'r3', description: 'ração petisco', amount: 2500, date: '2026-11-02', categoryId: 'pet' }),
      makeExpense({ id: 'm1', description: 'Mercado', amount: 32000, date: '2026-11-03', categoryId: 'dia', payment: { kind: 'credit', cardId: 'nu' } }),
      makeExpense({ id: 'old', description: 'Ração antiga', amount: 10000, date: '2026-01-10', categoryId: 'pet' }),
    ],
  });
  const charges = allCharges(data.expenses, data.cards);
  const search = (f: Partial<SearchFilters>) => searchCharges(data, charges, { ...EMPTY_FILTERS, ...f }, '2026-11-11');

  it('answers "how much did I spend on ração" with totals and a monthly series', () => {
    const r = search({ query: 'racao' });
    expect(r.items.map((c) => c.id)).toEqual(['r3', 'r2', 'r1']);
    expect([r.total, r.count, r.average]).toEqual([40480, 3, 13493]);
    expect(r.byMonth.map((m) => [m.label, m.total])).toEqual([
      ['ago', 0],
      ['set', 18990],
      ['out', 18990],
      ['nov', 2500],
    ]);
    expect(r.topMerchants[0]).toEqual({ name: 'Ração Golden', total: 37980, count: 2 });
    expect(r.filtered).toBe(true);
  });

  it('matches category and card names too', () => {
    expect(search({ query: 'pet' }).count).toBe(3);
    expect(search({ query: 'nubank' }).items.map((c) => c.id)).toEqual(['m1', 'r2']);
  });

  it('filters by value, category, payment and period', () => {
    expect(search({ query: 'acima de 100' }).items.map((c) => c.id)).toEqual(['m1', 'r2', 'r1']);
    expect(search({ categoryIds: ['dia'] }).items.map((c) => c.id)).toEqual(['m1']);
    expect(search({ paymentKeys: ['pix'] }).items.map((c) => c.id)).toEqual(['r3', 'r1']);
    expect(search({ minAmount: 2000, maxAmount: 3000 }).items.map((c) => c.id)).toEqual(['r3']);
    expect(search({ period: 'cycle' }).items.map((c) => c.id)).toEqual(['m1', 'r3']);
    expect(search({ query: 'ração', period: 'all' }).count).toBe(4);
  });

  it('lists everything in the period without filters', () => {
    const r = search({});
    expect(r.count).toBe(4);
    expect(r.filtered).toBe(false);
  });
});
