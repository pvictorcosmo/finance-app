/**
 * Modelo de dados do app.
 *
 * Valores em dinheiro são sempre inteiros em centavos (R$ 12,50 = 1250) para
 * evitar erros de arredondamento. Datas são strings ISO 'YYYY-MM-DD'.
 * Toda entidade tem id/createdAt/updatedAt para facilitar a sincronização
 * com a nuvem no futuro.
 */

export type ID = string;
export type ISODate = string;
export type Cents = number;

interface Entity {
  id: ID;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  /** Salário líquido mensal, em centavos. */
  salary: Cents;
  /** Dia em que o ciclo financeiro começa (1–31; em meses curtos usa o último dia). */
  cycleStartDay: number;
}

export type LimitType = 'amount' | 'percent';

/** Categoria de gasto variável (dia a dia, lazer, almoço, Uber...). */
export interface Category extends Entity {
  name: string;
  color: string;
  limitType: LimitType;
  /** Centavos quando limitType = 'amount'; porcentagem (0–100) do valor livre quando 'percent'. */
  limitValue: number;
}

export type PaymentMethod =
  | { kind: 'credit'; cardId: ID }
  | { kind: 'debit' }
  | { kind: 'pix' }
  | { kind: 'cash' };

/** Conta fixa mensal (aluguel, internet, academia...). */
export interface FixedBill extends Entity {
  name: string;
  amount: Cents;
  /** Dia do mês em que vence / é cobrada. */
  dueDay: number;
  payment: PaymentMethod;
}

export interface CreditCard extends Entity {
  name: string;
  color: string;
  /** Dia em que a fatura fecha. Compras a partir deste dia vão para a fatura seguinte. */
  closingDay: number;
  /** Dia de vencimento da fatura. */
  dueDay: number;
  /** Limite do cartão (opcional), em centavos. */
  limit?: Cents;
}

export interface Expense extends Entity {
  description: string;
  amount: Cents;
  /** Data da compra (ou data planejada, se futura). */
  date: ISODate;
  categoryId: ID;
  payment: PaymentMethod;
}

export interface FinanceData {
  settings: Settings;
  categories: Category[];
  fixedBills: FixedBill[];
  cards: CreditCard[];
  expenses: Expense[];
  /** Contas fixas marcadas como pagas, por ciclo: { [inícioDoCiclo]: billIds[] }. */
  fixedPaid: Record<ISODate, ID[]>;
}
