import { computeBudget, type Budget } from './budget';
import { allCharges } from './charges';
import { cycleFor, shiftCycle, type Cycle } from './cycle';
import type { Cents, FinanceData, ISODate } from './types';

export interface CycleSummary {
  cycle: Cycle;
  budget: Budget;
  /** true se o ciclo já terminou. */
  closed: boolean;
  /** Quanto este ciclo somou na poupança: sobra + renda direto para poupança. */
  saved: Cents;
}

/** Limite de segurança de ciclos percorridos (10 anos). */
const MAX_CYCLES = 120;

/** Todos os ciclos desde que o app começou a ser usado até o atual (mais antigo primeiro). */
export function cycleHistory(data: FinanceData, today: ISODate): CycleSummary[] {
  const startDay = data.settings.cycleStartDay;
  const charges = allCharges(data.expenses, data.cards);
  const current = cycleFor(today, startDay);
  const first = cycleFor(data.settings.startedAt <= today ? data.settings.startedAt : today, startDay);

  const result: CycleSummary[] = [];
  for (let c = first, i = 0; c.start <= current.start && i < MAX_CYCLES; c = shiftCycle(c, startDay, 1), i++) {
    const budget = computeBudget(data, c, today, charges);
    const closed = c.end < today;
    result.push({
      cycle: c,
      budget,
      closed,
      // No ciclo atual só conta o que já foi direto para a poupança; a sobra entra quando ele fechar.
      saved: closed ? budget.leftover + budget.directSavings : budget.directSavings,
    });
  }
  return result;
}

export function savingsTotal(history: CycleSummary[]): Cents {
  return history.reduce((sum, h) => sum + h.saved, 0);
}
