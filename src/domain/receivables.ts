import { splitInstallments } from './charges';
import { addMonthsISO } from './dates';
import type { Cents, ISODate, Receivable } from './types';

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
  /** Ainda falta receber. */
  open: Cents;
  /** Parte do que falta que já venceu. */
  overdue: Cents;
  received: Cents;
  nextDue?: ISODate;
}

/** Tabela "quem me deve": uma linha por pessoa. */
export function personSummaries(receivables: Receivable[], today: ISODate): PersonSummary[] {
  const byPerson = new Map<string, PersonSummary>();
  for (const inst of allReceivableInstallments(receivables, today)) {
    const name = inst.receivable.person.trim();
    const key = name.toLocaleLowerCase('pt-BR');
    const row = byPerson.get(key) ?? { person: name, open: 0, overdue: 0, received: 0 };
    if (inst.status === 'received') {
      row.received += inst.amount;
    } else {
      row.open += inst.amount;
      if (inst.status === 'overdue') row.overdue += inst.amount;
      if (!row.nextDue || inst.due < row.nextDue) row.nextDue = inst.due;
    }
    byPerson.set(key, row);
  }
  return [...byPerson.values()].sort(
    (a, b) => Number(b.open > 0) - Number(a.open > 0) || (a.nextDue ?? '9').localeCompare(b.nextDue ?? '9'),
  );
}
