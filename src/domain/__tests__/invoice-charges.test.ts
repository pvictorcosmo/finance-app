import { allCharges, expenseCharges, splitInstallments } from '../charges';
import { buildInvoice, invoiceForPurchase, upcomingInvoices } from '../invoice';
import { makeCard, makeExpense, makeFixedBill } from '@/test-utils/factories';

describe('invoiceForPurchase', () => {
  const nubank = { closingDay: 3, dueDay: 10 };
  const itau = { closingDay: 25, dueDay: 5 };

  it('puts purchases before the closing day in the current bill', () => {
    expect(invoiceForPurchase(nubank, '2026-11-02')).toEqual({ closing: '2026-11-03', due: '2026-11-10' });
  });

  it('moves purchases on/after the closing day to the next bill', () => {
    expect(invoiceForPurchase(nubank, '2026-11-03')).toEqual({ closing: '2026-12-03', due: '2026-12-10' });
  });

  it('handles bills due the month after closing', () => {
    expect(invoiceForPurchase(itau, '2026-11-20')).toEqual({ closing: '2026-11-25', due: '2026-12-05' });
    expect(invoiceForPurchase(itau, '2026-11-26')).toEqual({ closing: '2026-12-25', due: '2027-01-05' });
  });
});

describe('installments', () => {
  const card = makeCard({ id: 'nu' });

  it('splits totals putting leftover cents in the first installment', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
  });

  it('creates one charge per month, each in its own bill', () => {
    const phone = makeExpense({
      id: 'p',
      description: 'Celular',
      amount: 50000,
      date: '2026-11-02',
      categoryId: 'c',
      payment: { kind: 'credit', cardId: 'nu' },
      installments: 10,
    });
    const charges = expenseCharges(phone, [card]);
    expect(charges).toHaveLength(10);
    expect(charges[0].invoiceDue).toBe('2026-11-10');
    expect(charges[9].invoiceDue).toBe('2027-08-10');
    expect(charges[1].description).toBe('Celular (2/10)');
    expect(charges[1].date).toBe('2026-12-02');
  });

  it('ignores installments for non-credit payments', () => {
    const pix = makeExpense({ id: 'x', amount: 9000, date: '2026-11-02', categoryId: 'c', installments: 3 });
    expect(expenseCharges(pix, [card])).toHaveLength(1);
  });
});

describe('invoices', () => {
  const card = makeCard({ id: 'nu' });
  const phone = makeExpense({
    id: 'p',
    amount: 50000,
    date: '2026-11-02',
    categoryId: 'c',
    payment: { kind: 'credit', cardId: 'nu' },
    installments: 10,
  });
  const charges = allCharges([phone], [card]);

  it('marks paid and open invoices', () => {
    const list = upcomingInvoices(card, charges, [], '2026-11-03', ['2026-11-10']);
    expect(list.slice(0, 2).map((i) => [i.due, i.total, i.paid, i.status])).toEqual([
      ['2026-11-10', 5000, true, 'closed'],
      ['2026-12-10', 5000, false, 'open'],
    ]);
  });

  it('flags unpaid past invoices as overdue', () => {
    const late = buildInvoice(card, { y: 2026, m: 11 }, charges, [], '2026-11-20', []);
    expect(late.status).toBe('past');
    expect(late.overdue).toBe(true);
  });

  it('adds fixed bills paid by card to every bill', () => {
    const netflix = makeFixedBill({ id: 'n', amount: 4000, dueDay: 15, payment: { kind: 'credit', cardId: 'nu' } });
    const inv = buildInvoice(card, { y: 2026, m: 12 }, [], [netflix], '2026-11-04');
    expect(inv.items.map((i) => [i.date, i.source])).toEqual([['2026-11-15', 'fixed']]);
    expect(inv.total).toBe(4000);
  });
});
