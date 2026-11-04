import type { Charge } from './charges';
import { addMonths, clampDay, parseISO, toISO, type YM } from './dates';
import type { Cents, CreditCard, FixedBill, ID, ISODate } from './types';

export interface InvoiceDates {
  /** Dia em que a fatura fecha (compras a partir deste dia vão para a próxima). */
  closing: ISODate;
  due: ISODate;
}

export interface InvoiceItem {
  id: ID;
  /** Compra (ou acordo, se source = 'agreement') de origem, para abrir a edição. */
  expenseId?: ID;
  description: string;
  amount: Cents;
  date: ISODate;
  source: 'expense' | 'fixed' | 'agreement';
}

/** closed = já fechou e falta pagar; open = recebendo compras agora; future = próximas; past = vencida. */
export type InvoiceStatus = 'closed' | 'open' | 'future' | 'past';

export interface Invoice extends InvoiceDates {
  cardId: ID;
  total: Cents;
  items: InvoiceItem[];
  status: InvoiceStatus;
  paid: boolean;
  /** Venceu, tinha valor e não foi marcada como paga. */
  overdue: boolean;
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

/** Monta a fatura de um cartão que vence no mês `dueMonth`, com compras/parcelas e contas fixas. */
export function buildInvoice(
  card: CreditCard,
  dueMonth: YM,
  charges: Charge[],
  fixedBills: FixedBill[],
  today: ISODate,
  paidDues: ISODate[] = [],
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
  for (const c of charges) {
    if (c.payment.kind === 'credit' && c.payment.cardId === card.id && c.invoiceDue === dates.due) {
      items.push({
        id: c.id,
        expenseId: c.expenseId,
        description: c.description,
        amount: c.amount,
        date: c.date,
        source: c.source ?? 'expense',
      });
    }
  }

  // Contas fixas no cartão: uma cobrança por mês no dia de vencimento, a partir do cadastro.
  const closing = parseISO(dates.closing);
  const belongs = (date: ISODate) => invoiceForPurchase(card, date).due === dates.due;
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
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  const paid = paidDues.includes(dates.due);
  return {
    ...dates,
    cardId: card.id,
    status,
    items,
    total,
    paid,
    overdue: status === 'past' && !paid && total > 0,
  };
}

/**
 * Faturas que importam agora: as atrasadas (vencidas e não pagas), a fechada,
 * a aberta e as próximas `ahead` (podem ter parcelas ou contas fixas).
 */
export function upcomingInvoices(
  card: CreditCard,
  charges: Charge[],
  fixedBills: FixedBill[],
  today: ISODate,
  paidDues: ISODate[] = [],
  ahead = 3,
): Invoice[] {
  const currentDue = parseISO(invoiceForPurchase(card, today).due);
  const result: Invoice[] = [];
  for (let k = -3; k <= ahead; k++) {
    const inv = buildInvoice(card, addMonths(currentDue, k), charges, fixedBills, today, paidDues);
    if (inv.status !== 'past' || inv.overdue) result.push(inv);
  }
  return result;
}
