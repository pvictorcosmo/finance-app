import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { SpendingBreakdown } from '../spending-breakdown';
import { categoryBreakdown, previousCycleCharges } from '@/domain/breakdown';
import { computeBudget } from '@/domain/budget';
import { cycleFor } from '@/domain/cycle';
import { makeCategory, makeData, makeExpense } from '@/test-utils/factories';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

const today = '2026-11-11';
const data = makeData({
  settings: { salary: 500000, cycleStartDay: 1, startedAt: '2026-01-01' },
  categories: [makeCategory({ id: 'dia', name: 'Dia a dia' }), makeCategory({ id: 'uber', name: 'Uber' })],
  expenses: [
    makeExpense({ id: '1', description: 'Mercado', amount: 12000, date: '2026-11-03', categoryId: 'dia' }),
    makeExpense({ id: '2', description: 'Padaria', amount: 1500, date: '2026-11-04', categoryId: 'dia' }),
    makeExpense({ id: '3', description: 'Padaria', amount: 2500, date: '2026-11-06', categoryId: 'dia' }),
    makeExpense({ id: '4', description: 'Uber', amount: 3000, date: '2026-11-05', categoryId: 'uber' }),
    // Previous cycle, up to the same day: 10 000 in Dia a dia.
    makeExpense({ id: 'p', description: 'Mercado', amount: 10000, date: '2026-10-05', categoryId: 'dia' }),
  ],
});
const cycle = cycleFor(today, 1);
const charges = computeBudget(data, cycle, today).charges;
const breakdown = categoryBreakdown(charges, previousCycleCharges(data, cycle, today, true), data.categories);

async function renderBreakdown() {
  await render(<SpendingBreakdown data={data} charges={charges} breakdown={breakdown} isCurrent />);
}

describe('SpendingBreakdown', () => {
  it('ranks the categories with share and compares with the previous cycle', async () => {
    await renderBreakdown();
    expect(screen.getByText('PARA ONDE FOI SEU DINHEIRO')).toBeTruthy();
    expect(screen.getByText('84% · 3 compras')).toBeTruthy();
    expect(screen.getByText('16% · 1 compra')).toBeTruthy();
    expect(screen.getByText('▲ 90% a mais que no ciclo anterior até hoje')).toBeTruthy();
  });

  it('shows what is spent most inside a category when it is tapped', async () => {
    await renderBreakdown();
    await fireEvent.press(screen.getByLabelText(/^Dia a dia: /));
    expect(screen.getByText('ONDE VOCÊ MAIS GASTA EM DIA A DIA')).toBeTruthy();
    expect(screen.getByText('1× · 75%')).toBeTruthy(); // Mercado
    expect(screen.getByText('2× · 25%')).toBeTruthy(); // Padaria
    expect(screen.getByText('▲ 60% a mais que no ciclo anterior até hoje')).toBeTruthy();
  });

  it('opens the statement filtered by the tapped purchase', async () => {
    await renderBreakdown();
    await fireEvent.press(screen.getByLabelText(/^Dia a dia: /));
    await fireEvent.press(screen.getByLabelText(/^Padaria: /));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/extrato',
      params: expect.objectContaining({ q: 'Padaria', category: 'dia' }),
    });
  });

  it('renders nothing without spending', async () => {
    const empty = categoryBreakdown([], [], data.categories);
    await render(<SpendingBreakdown data={data} charges={[]} breakdown={empty} isCurrent />);
    expect(screen.queryByText('PARA ONDE FOI SEU DINHEIRO')).toBeNull();
  });
});
