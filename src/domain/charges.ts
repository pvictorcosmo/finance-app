import { addMonths, addMonthsISO, parseISO } from './dates';
import { invoiceDatesForDueMonth, invoiceForPurchase } from './invoice';
import type { CardBudgetBasis, Cents, CreditCard, Expense, ID, ISODate, PaymentMethod } from './types';

/**
 * Uma cobrança concreta. Uma compra à vista gera uma; uma compra em 10x gera dez,
 * uma por mês, cada uma na sua fatura e contando no orçamento do seu ciclo.
 */
export interface Charge {
  id: string;
  expenseId: ID;
  description: string;
  amount: Cents;
  /** Data em que a cobrança conta no orçamento (compra + i meses). */
  date: ISODate;
  categoryId: ID;
  payment: PaymentMethod;
  /** 0-based */
  index: number;
  count: number;
  /** Vencimento da fatura em que esta parcela cai (só cartão de crédito). */
  invoiceDue?: ISODate;
  /** De onde veio: uma compra (padrão) ou o Y de um acordo mensal (fora do orçamento). */
  source?: 'expense' | 'agreement';
}

/**
 * Date on which a charge weighs on the budget.
 * @param charge The charge.
 * @param basis `due` (default): card charges count on their invoice due date; `purchase`: on the purchase date.
 * @returns The invoice due date for card charges under `due`, otherwise the charge date.
 */
export function budgetDate(charge: Charge, basis: CardBudgetBasis = 'due'): ISODate {
  return basis === 'due' && charge.invoiceDue ? charge.invoiceDue : charge.date;
}

/** Divide o total em `n` parcelas inteiras; os centavos que sobram vão na primeira. */
export function splitInstallments(total: Cents, n: number): Cents[] {
  const count = Math.max(1, Math.floor(n));
  const base = Math.floor(total / count);
  const rest = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i === 0 ? rest : 0));
}

export function installmentCount(e: Pick<Expense, 'installments' | 'payment'>): number {
  return e.payment.kind === 'credit' ? Math.max(1, e.installments ?? 1) : 1;
}

export function expenseCharges(e: Expense, cards: CreditCard[]): Charge[] {
  const count = installmentCount(e);
  const payment = e.payment;
  const card = payment.kind === 'credit' ? cards.find((c) => c.id === payment.cardId) : undefined;
  const firstDue = card ? parseISO(invoiceForPurchase(card, e.date).due) : undefined;

  return splitInstallments(e.amount, count).map((amount, index) => ({
    id: count > 1 ? `${e.id}#${index}` : e.id,
    expenseId: e.id,
    description: count > 1 ? `${e.description} (${index + 1}/${count})` : e.description,
    amount,
    date: addMonthsISO(e.date, index),
    categoryId: e.categoryId,
    payment: e.payment,
    index,
    count,
    invoiceDue: card && firstDue ? invoiceDatesForDueMonth(card, addMonths(firstDue, index)).due : undefined,
  }));
}

export function allCharges(expenses: Expense[], cards: CreditCard[]): Charge[] {
  return expenses.flatMap((e) => expenseCharges(e, cards));
}
