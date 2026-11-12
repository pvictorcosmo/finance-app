import { categoryBreakdown, changeRatio, chargesOfSlice, merchantTotals, topMerchants, UNCATEGORIZED } from '../breakdown';
import { allCharges } from '../charges';
import { makeCategory, makeExpense } from '@/test-utils/factories';

const dia = makeCategory({ id: 'dia', name: 'Dia a dia', color: '#111111' });
const uber = makeCategory({ id: 'uber', name: 'Uber' });
const categories = [dia, uber];

const charges = allCharges(
  [
    makeExpense({ id: '1', description: 'Padaria', amount: 1500, date: '2026-11-02', categoryId: 'dia' }),
    makeExpense({ id: '2', description: 'Padaria', amount: 2500, date: '2026-11-05', categoryId: 'dia' }),
    makeExpense({ id: '3', description: 'Mercado Extra', amount: 12000, date: '2026-11-06', categoryId: 'dia' }),
    makeExpense({ id: '4', description: 'Tomada', amount: 1000, date: '2026-11-07', categoryId: 'dia' }),
    makeExpense({ id: '5', description: 'UBER *TRIP 1234', amount: 2000, date: '2026-11-03', categoryId: 'uber' }),
    makeExpense({ id: '6', description: 'Uber *trip 9876', amount: 3000, date: '2026-11-08', categoryId: 'uber' }),
    makeExpense({ id: '7', description: 'Café', amount: 800, date: '2026-11-09', categoryId: 'deleted' }),
  ],
  [],
);
const previous = allCharges(
  [makeExpense({ id: 'p1', description: 'Mercado', amount: 10000, date: '2026-10-06', categoryId: 'dia' })],
  [],
);

describe('categoryBreakdown', () => {
  const result = categoryBreakdown(charges, previous, categories);

  it('sums per category, highest first, with share and previous value', () => {
    expect(result.total).toBe(22800);
    expect(result.previousTotal).toBe(10000);
    expect(result.slices.map((s) => [s.id, s.total, s.count])).toEqual([
      ['dia', 17000, 4],
      ['uber', 5000, 2],
      [UNCATEGORIZED, 800, 1],
    ]);
    expect(result.slices[0]).toMatchObject({ name: 'Dia a dia', color: '#111111', previous: 10000 });
    expect(result.slices[0].share).toBeCloseTo(17000 / 22800);
    expect(result.slices[2].name).toBe('Sem categoria');
  });

  it('leaves out categories without spending', () => {
    expect(categoryBreakdown([], previous, categories).slices).toEqual([]);
  });
});

describe('merchantTotals / topMerchants', () => {
  it('groups the same merchant written differently', () => {
    expect(merchantTotals(chargesOfSlice(charges, 'uber', categories))).toEqual([
      { name: 'UBER *TRIP 1234', total: 5000, count: 2 },
    ]);
  });

  it('shows what is spent most inside a category', () => {
    const { rows, others } = topMerchants(chargesOfSlice(charges, 'dia', categories), 2);
    expect(rows).toEqual([
      { name: 'Mercado Extra', total: 12000, count: 1 },
      { name: 'Padaria', total: 4000, count: 2 },
    ]);
    expect(others).toEqual({ name: 'Tomada', total: 1000, count: 1 });
  });

  it('names the remainder "Outros (n)" when several merchants are folded', () => {
    const { others } = topMerchants(chargesOfSlice(charges, 'dia', categories), 1);
    expect(others).toEqual({ name: 'Outros (2)', total: 5000, count: 3 });
  });

  it('treats installments as one purchase', () => {
    const installments = allCharges(
      [makeExpense({ id: 'c', description: 'Celular', amount: 30000, date: '2026-11-01', categoryId: 'dia', installments: 3, payment: { kind: 'credit', cardId: 'nu' } })],
      [],
    );
    expect(merchantTotals(installments)).toEqual([{ name: 'Celular', total: 30000, count: 3 }]);
  });
});

describe('chargesOfSlice', () => {
  it('returns charges of deleted categories for the uncategorized slice', () => {
    expect(chargesOfSlice(charges, UNCATEGORIZED, categories).map((c) => c.description)).toEqual(['Café']);
  });
});

describe('changeRatio', () => {
  it('compares with the previous period', () => {
    expect(changeRatio(17000, 10000)).toBe(0.7);
    expect(changeRatio(9000, 10000)).toBe(-0.1);
    expect(changeRatio(5000, 0)).toBeNull();
  });
});
