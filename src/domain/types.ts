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

export interface Entity {
  id: ID;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  /** Salário líquido mensal, em centavos. */
  salary: Cents;
  /** Dia em que o ciclo financeiro começa (1–31; em meses curtos usa o último dia). */
  cycleStartDay: number;
  /** Quando o app começou a ser usado: a poupança e o histórico contam a partir daqui. */
  startedAt: ISODate;
  /** Notificação diária com o resumo do mês. */
  dailySummary?: DailySummarySettings;
}

export interface DailySummarySettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export type LimitType = 'amount' | 'percent';

/** Categoria de gasto variável (dia a dia, lazer, almoço, Uber...). */
export interface Category extends Entity {
  name: string;
  color: string;
  /** Nome do ícone (chave de components/icon). Opcional: sem ele, é sugerido pelo nome. */
  icon?: string;
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
  /** Valor total da compra (somando todas as parcelas). */
  amount: Cents;
  /** Data da compra (ou data planejada, se futura). */
  date: ISODate;
  categoryId: ID;
  payment: PaymentMethod;
  /** Número de parcelas no cartão de crédito (1 = à vista). */
  installments?: number;
}

export type IncomeKind = 'freela' | 'thirteenth' | 'meal' | 'bonus' | 'other';
/** budget = soma no valor livre do ciclo; savings = vai direto para a poupança. */
export type IncomeDestination = 'budget' | 'savings';

/** Renda além do salário: freela, 13º, vale-refeição, bônus... */
export interface Income extends Entity {
  description: string;
  amount: Cents;
  kind: IncomeKind;
  recurrence: 'once' | 'monthly';
  /** 'once': dia em que recebe. 'monthly': a partir de quando (o dia do mês se repete). */
  date: ISODate;
  /** Só para 'monthly': último dia em que ainda conta (renda encerrada). */
  endDate?: ISODate;
  destination: IncomeDestination;
}

/** Dinheiro que alguém te deve. */
export interface Receivable extends Entity {
  person: string;
  description: string;
  /** Valor total devido. */
  amount: Cents;
  /** Quando você emprestou / pagou pela pessoa. */
  lentDate: ISODate;
  /** Quando vence o (primeiro) pagamento. */
  firstDue: ISODate;
  /** Em quantas vezes a pessoa vai pagar (1 por mês a partir de firstDue). */
  installments: number;
  /** Parcelas recebidas: índice da parcela -> data em que recebeu. */
  received: Record<number, ISODate>;
}

/**
 * Acordo mensal com uma pessoa: ela te paga X por mês e você paga Y por ela.
 * Um valor abate o outro; o que importa é o saldo de cada mês.
 * O Y não conta no orçamento das suas categorias (é gasto dela).
 */
export interface Agreement extends Entity {
  person: string;
  description: string;
  /** Quanto a pessoa te paga por mês (X). */
  theyPay: Cents;
  /** Quanto você paga por ela por mês (Y). */
  iPay: Cents;
  /** Como você paga o Y. null = só um combinado (nenhum dinheiro sai, só abate). */
  iPayMethod: PaymentMethod | null;
  /** Primeiro mês do acordo; o dia se repete todo mês. */
  startDate: ISODate;
  /** Duração em meses (ausente = sem prazo). */
  months?: number;
  /** Encerrado: não gera meses depois desta data. */
  endDate?: ISODate;
  /** Meses acertados: data do mês -> data em que acertaram. */
  settled: Record<ISODate, ISODate>;
}

/** Categoria como estava num ciclo fechado. */
export type PlanCategory = Pick<Category, 'id' | 'name' | 'color' | 'icon' | 'limitType' | 'limitValue'>;

/**
 * "Foto" do planejamento de um ciclo quando ele termina, para o histórico
 * não mudar se você alterar o salário ou as contas fixas depois.
 */
export interface CycleSnapshot {
  start: ISODate;
  end: ISODate;
  salary: Cents;
  fixed: Cents;
  categories: PlanCategory[];
  closedAt: string;
}

export interface FinanceData {
  settings: Settings;
  categories: Category[];
  fixedBills: FixedBill[];
  cards: CreditCard[];
  expenses: Expense[];
  incomes: Income[];
  receivables: Receivable[];
  agreements: Agreement[];
  /** Contas fixas marcadas como pagas, por ciclo: { [inícioDoCiclo]: billIds[] }. */
  fixedPaid: Record<ISODate, ID[]>;
  /** Faturas pagas: { [cardId]: datasDeVencimento[] }. */
  invoicePaid: Record<ID, ISODate[]>;
  snapshots: CycleSnapshot[];
}
