import { agreementCardCharges } from './agreements';
import { allCharges, type Charge } from './charges';
import { addMonthsISO } from './dates';
import type { FinanceData, ISODate } from './types';

/** Até quando gerar cobranças de acordos sem prazo (para as faturas futuras). */
const HORIZON_MONTHS = 24;

/**
 * Tudo que entra nas faturas dos cartões: compras/parcelas + o Y dos acordos pagos no crédito.
 * (O orçamento usa só allCharges, porque o Y dos acordos é gasto da outra pessoa.)
 */
export function invoiceCharges(data: Pick<FinanceData, 'expenses' | 'cards' | 'agreements'>, today: ISODate): Charge[] {
  return [
    ...allCharges(data.expenses, data.cards),
    ...agreementCardCharges(data.agreements, data.cards, addMonthsISO(today, HORIZON_MONTHS)),
  ];
}
