import { agreementCardCharges, agreementOccurrences } from '../agreements';
import { computeBudget } from '../budget';
import { cycleFor } from '../cycle';
import { buildInvoice } from '../invoice';
import { invoiceCharges } from '../invoice-charges';
import { personSummaries, receivableInstallments } from '../receivables';
import { makeAgreement, makeCard, makeData, makeReceivable } from '@/test-utils/factories';

describe('receivables', () => {
  const ana = makeReceivable({
    id: 'r',
    person: 'Ana ',
    amount: 30000,
    firstDue: '2026-10-20',
    installments: 3,
    received: { 0: '2026-10-20' },
  });

  it('tracks each installment status', () => {
    expect(receivableInstallments(ana, '2026-11-25').map((i) => i.status)).toEqual(['received', 'overdue', 'pending']);
  });

  it('groups by person ignoring case and spaces', () => {
    const extra = makeReceivable({ id: 'r2', person: 'ana', amount: 5000, firstDue: '2027-01-01' });
    expect(personSummaries([ana, extra], [], '2026-11-25')).toEqual([
      { person: 'Ana', open: 25000, overdue: 10000, received: 10000, hasAgreement: false, nextDue: '2026-11-20' },
    ]);
  });
});

describe('agreements', () => {
  const nu = makeCard({ id: 'nu' });
  const ana = makeAgreement({
    id: 'a1',
    person: 'Ana',
    theyPay: 15000,
    iPay: 10000,
    iPayMethod: { kind: 'credit', cardId: 'nu' },
    startDate: '2026-09-15',
    months: 4,
    settled: { '2026-09-15': '2026-09-16' },
  });

  it('computes the monthly net and status', () => {
    expect(agreementOccurrences(ana, '2027-12-31', '2026-11-04').map((o) => [o.date, o.net, o.status])).toEqual([
      ['2026-09-15', 5000, 'settled'],
      ['2026-10-15', 5000, 'overdue'],
      ['2026-11-15', 5000, 'pending'],
      ['2026-12-15', 5000, 'pending'],
    ]);
  });

  it('auto-compensates months when both sides are equal', () => {
    const even = makeAgreement({ id: 'b', person: 'Bruno', theyPay: 8000, iPay: 8000, startDate: '2026-10-01' });
    expect(agreementOccurrences(even, '2027-01-01', '2026-11-04').every((o) => o.status === 'compensated')).toBe(true);
  });

  it('stops generating months after the end date', () => {
    const ended = makeAgreement({ id: 'c', person: 'C', theyPay: 1, iPay: 0, startDate: '2026-10-01', endDate: '2026-11-30' });
    expect(agreementOccurrences(ended, '2027-06-01', '2026-11-04')).toHaveLength(2);
  });

  it('charges the card for what you pay by credit, outside the budget', () => {
    expect(agreementCardCharges([ana], [nu], '2027-12-31').map((c) => c.invoiceDue)).toEqual([
      '2026-10-10',
      '2026-11-10',
      '2026-12-10',
      '2027-01-10',
    ]);
    const inv = buildInvoice(nu, { y: 2026, m: 12 }, invoiceCharges({ expenses: [], cards: [nu], agreements: [ana] }, '2026-11-04'), [], '2026-11-04');
    expect([inv.total, inv.items[0].source]).toEqual([10000, 'agreement']);

    const data = makeData({ settings: { salary: 300000, cycleStartDay: 1, startedAt: '2026-08-01' }, cards: [nu], agreements: [ana] });
    expect(computeBudget(data, cycleFor('2026-11-04', 1), '2026-11-04').spent).toBe(0);
  });

  it('nets loans and agreements per person with a signed balance', () => {
    const carla = makeAgreement({
      id: 'c1',
      person: 'Carla',
      theyPay: 2000,
      iPay: 5000,
      iPayMethod: { kind: 'pix' },
      startDate: '2026-11-20',
      months: 2,
    });
    const rows = personSummaries([], [ana, carla], '2026-11-04');
    expect(rows.map((p) => [p.person, p.open, p.overdue])).toEqual([
      ['Ana', 10000, 5000],
      ['Carla', -3000, 0],
    ]);
  });
});
