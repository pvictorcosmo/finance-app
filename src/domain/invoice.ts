import { addMonths, clampDay, parseISO, toISO, type YM } from './dates';
import type { Cents, CreditCard, Expense, FixedBill, ID, ISODate } from './types';

export interface InvoiceDates {
  /** Dia em que a fatura fecha (compras a partir deste dia vão para a próxima). */
  closing: ISODate;
  due: ISODate;
}

export interface InvoiceItem {
  id: ID;
  description: string;
  amount: Cents;
  date: ISODate;
  source: 'expense' | 'fixed';
}

/** closed = já fechou e falta pagar; open = recebendo compras agora; future = próximas. */
export type InvoiceStatus = 'closed' | 'open' | 'future' | 'past';

export interface Invoice extends InvoiceDates {
  cardId: ID;
  total: Cents;
  items: InvoiceItem[];
  status: InvoiceStatus;
}

type CardDays = Pick<CreditCard, 'closingDay' | 'dueDay'>;

const monthIndex = ({ y, m }: YM) => y * 12 + m;

/** Datas da fatura que vence no mês `dueMonth`. */
export function invoiceDatesForDueMonth(card: CardDays, dueMonth: YM): InvoiceDates {
  const closingMonth = card.dueDay > card.closingDay ? dueMonth : addMonths(dueMonth, -1);
  return {
    closing: toISO(clampDay(closingMonth.y, closingMonth.m, card.closingDay)),
    due: toISO(clampDay(dueMonth.y, dueMonth.m, card.dueDay)),
  };
}

/** Em qual fatura cai uma compra feita em `purchase`. */
export function invoiceForPurchase(card: CardDays, purchase: ISODate): InvoiceDates {
  const p = parseISO(purchase);
  const closingThisMonth = clampDay(p.y, p.m, card.closingDay);
  const closingMonth = p.d >= closingThisMonth.d ? addMonths(p, 1) : { y: p.y, m: p.m };
  const dueMonth = card.dueDay > card.closingDay ? closingMonth : addMonths(closingMonth, 1);
  return invoiceDatesForDueMonth(card, dueMonth);
}

/** Monta a fatura de um cartão que vence no mês `dueMonth`, com compras e contas fixas. */
export function buildInvoice(
  card: CreditCard,
  dueMonth: YM,
  expenses: Expense[],
  fixedBills: FixedBill[],
  today: ISODate,
): Invoice {
  const dates = invoiceDatesForDueMonth(card, dueMonth);
  const current = invoiceForPurchase(card, today);
  const status: InvoiceStatus =
    dates.due === current.due
      ? 'open'
      : dates.due > current.due
        ? 'future'
        : dates.due >= today
          ? 'closed'
          : 'past';

  const items: InvoiceItem[] = [];
  const belongs = (date: ISODate) => invoiceForPurchase(card, date).due === dates.due;

  for (const e of expenses) {
    if (e.payment.kind === 'credit' && e.payment.cardId === card.id && belongs(e.date)) {
      items.push({ id: e.id, description: e.description, amount: e.amount, date: e.date, source: 'expense' });
    }
  }

  // Contas fixas no cartão: uma cobrança por mês no dia de vencimento, a partir do cadastro.
  const closing = parseISO(dates.closing);
  for (const bill of fixedBills) {
    if (bill.payment.kind !== 'credit' || bill.payment.cardId !== card.id) continue;
    const since = bill.createdAt.slice(0, 10);
    for (let ym = addMonths(closing, -1); monthIndex(ym) <= monthIndex(closing); ym = addMonths(ym, 1)) {
      const date = toISO(clampDay(ym.y, ym.m, bill.dueDay));
      if (date >= since && belongs(date)) {
        items.push({ id: `${bill.id}:${date}`, description: bill.name, amount: bill.amount, date, source: 'fixed' });
      }
    }
  }

  items.sort((a, b) => b.date.localeCompare(a.date));
  return {
    ...dates,
    cardId: card.id,
    status,
    items,
    total: items.reduce((sum, i) => sum + i.amount, 0),
  };
}

/**
 * Faturas que ainda vão ser pagas: a fechada (se não venceu), a aberta
 * e as próximas `ahead` (podem ter compras futuras ou contas fixas).
 */
export function upcomingInvoices(
  card: CreditCard,
  expenses: Expense[],
  fixedBills: FixedBill[],
  today: ISODate,
  ahead = 3,
): Invoice[] {
  const currentDue = parseISO(invoiceForPurchase(card, today).due);
  const result: Invoice[] = [];
  for (let k = -1; k <= ahead; k++) {
    const inv = buildInvoice(card, addMonths(currentDue, k), expenses, fixedBills, today);
    if (inv.status !== 'past') result.push(inv);
  }
  return result;
}
