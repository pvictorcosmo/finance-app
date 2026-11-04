import { splitInstallments } from './charges';
import { allAgreementOccurrences, isOpen } from './agreements';
import { addMonthsISO } from './dates';
import type { Agreement, Cents, ISODate, Receivable } from './types';

export type ReceivableStatus = 'received' | 'overdue' | 'pending';

export interface ReceivableInstallment {
  receivable: Receivable;
  /** 0-based */
  index: number;
  count: number;
  amount: Cents;
  due: ISODate;
  receivedOn?: ISODate;
  status: ReceivableStatus;
}

export function receivableInstallments(r: Receivable, today: ISODate): ReceivableInstallment[] {
  const count = Math.max(1, r.installments);
  return splitInstallments(r.amount, count).map((amount, index) => {
    const due = addMonthsISO(r.firstDue, index);
    const receivedOn = r.received[index];
    return {
      receivable: r,
      index,
      count,
      amount,
      due,
      receivedOn,
      status: receivedOn ? 'received' : due < today ? 'overdue' : 'pending',
    };
  });
}

export function allReceivableInstallments(receivables: Receivable[], today: ISODate): ReceivableInstallment[] {
  return receivables.flatMap((r) => receivableInstallments(r, today));
}

export interface PersonSummary {
  person: string;
  /** Saldo em aberto: positivo = a pessoa te deve; negativo = você deve a ela. */
  open: Cents;
  /** Parte do saldo que já venceu (mesmo sinal). */
  overdue: Cents;
  received: Cents;
  nextDue?: ISODate;
  /** Tem acordo mensal ativo com a pessoa. */
  hasAgreement: boolean;
}

/** Até quando os acordos sem prazo contam no "em aberto": o mês que vem. */
export function agreementHorizon(today: ISODate): ISODate {
  return addMonthsISO(today, 1);
}

/** Tabela "quem me deve": uma linha por pessoa (empréstimos + acordos mensais). */
export function personSummaries(receivables: Receivable[], agreements: Agreement[], today: ISODate): PersonSummary[] {
  const byPerson = new Map<string, PersonSummary>();
  const rowFor = (person: string) => {
    const name = person.trim();
    const key = name.toLocaleLowerCase('pt-BR');
    const row = byPerson.get(key) ?? { person: name, open: 0, overdue: 0, received: 0, hasAgreement: false };
    byPerson.set(key, row);
    return row;
  };
  const bumpNext = (row: PersonSummary, date: ISODate) => {
    if (!row.nextDue || date < row.nextDue) row.nextDue = date;
  };

  for (const inst of allReceivableInstallments(receivables, today)) {
    const row = rowFor(inst.receivable.person);
    if (inst.status === 'received') {
      row.received += inst.amount;
    } else {
      row.open += inst.amount;
      if (inst.status === 'overdue') row.overdue += inst.amount;
      bumpNext(row, inst.due);
    }
  }

  for (const o of allAgreementOccurrences(agreements, agreementHorizon(today), today)) {
    const row = rowFor(o.agreement.person);
    row.hasAgreement = true;
    if (o.status === 'settled') {
      if (o.net > 0) row.received += o.net;
    } else if (isOpen(o)) {
      row.open += o.net;
      if (o.status === 'overdue') row.overdue += o.net;
      bumpNext(row, o.date);
    }
  }

  return [...byPerson.values()].sort(
    (a, b) => Number(b.open !== 0) - Number(a.open !== 0) || (a.nextDue ?? '9').localeCompare(b.nextDue ?? '9'),
  );
}
