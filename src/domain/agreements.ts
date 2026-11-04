import type { Charge } from './charges';
import { addMonthsISO } from './dates';
import { invoiceForPurchase } from './invoice';
import type { Agreement, Cents, CreditCard, ISODate } from './types';

/** compensated = X e Y iguais, nada a acertar; settled = marcado como acertado. */
export type AgreementStatus = 'settled' | 'compensated' | 'overdue' | 'pending';

export interface AgreementOccurrence {
  agreement: Agreement;
  /** Data do mês (dia do acordo). */
  date: ISODate;
  /** 0-based */
  index: number;
  theyPay: Cents;
  iPay: Cents;
  /** Saldo do mês: positivo = a pessoa te deve; negativo = você deve a ela. */
  net: Cents;
  settledOn?: ISODate;
  status: AgreementStatus;
}

/** Limite de segurança para acordos sem prazo. */
const MAX_MONTHS = 240;

/** Meses do acordo até a data `until` (inclusive). */
export function agreementOccurrences(a: Agreement, until: ISODate, today: ISODate): AgreementOccurrence[] {
  const net = a.theyPay - a.iPay;
  const result: AgreementOccurrence[] = [];
  for (let index = 0; index < MAX_MONTHS; index++) {
    if (a.months !== undefined && index >= a.months) break;
    const date = addMonthsISO(a.startDate, index);
    if (date > until || (a.endDate && date > a.endDate)) break;
    const settledOn = a.settled[date];
    result.push({
      agreement: a,
      date,
      index,
      theyPay: a.theyPay,
      iPay: a.iPay,
      net,
      settledOn,
      status: settledOn ? 'settled' : net === 0 ? 'compensated' : date < today ? 'overdue' : 'pending',
    });
  }
  return result;
}

export function allAgreementOccurrences(agreements: Agreement[], until: ISODate, today: ISODate) {
  return agreements.flatMap((a) => agreementOccurrences(a, until, today));
}

/** O que ainda precisa de ação (não acertado e com saldo diferente de zero). */
export function isOpen(o: AgreementOccurrence): boolean {
  return o.status === 'overdue' || o.status === 'pending';
}

/**
 * Cobranças no cartão geradas pelo Y dos acordos pagos no crédito.
 * Entram nas faturas, mas não no orçamento das categorias.
 */
export function agreementCardCharges(agreements: Agreement[], cards: CreditCard[], until: ISODate): Charge[] {
  const charges: Charge[] = [];
  for (const a of agreements) {
    const method = a.iPayMethod;
    if (!method || method.kind !== 'credit' || a.iPay <= 0) continue;
    const card = cards.find((c) => c.id === method.cardId);
    if (!card) continue;
    for (const o of agreementOccurrences(a, until, until)) {
      charges.push({
        id: `${a.id}@${o.date}`,
        expenseId: a.id,
        description: `${a.description} (${a.person})`,
        amount: a.iPay,
        date: o.date,
        categoryId: '',
        payment: method,
        index: 0,
        count: 1,
        invoiceDue: invoiceForPurchase(card, o.date).due,
        source: 'agreement',
      });
    }
  }
  return charges;
}

/** "Ana te deve R$ 50" / "Você deve R$ 20" / "Quites" — só o texto do lado, sem o valor. */
export function netLabel(net: Cents, person: string): string {
  if (net > 0) return `${person} te deve`;
  if (net < 0) return 'Você deve';
  return 'Quites';
}
