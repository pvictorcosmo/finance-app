import { addDays, addMonths, clampDay, diffDays, parseISO, toISO } from './dates';
import type { ISODate } from './types';

/** Um ciclo financeiro: do dia de início (ex.: dia do salário) até a véspera do próximo. */
export interface Cycle {
  start: ISODate;
  end: ISODate;
  days: number;
}

function startIn(y: number, m: number, startDay: number): ISODate {
  return toISO(clampDay(y, m, startDay));
}

export function cycleFor(date: ISODate, startDay: number): Cycle {
  const { y, m } = parseISO(date);
  let start = startIn(y, m, startDay);
  if (date < start) {
    const prev = addMonths({ y, m }, -1);
    start = startIn(prev.y, prev.m, startDay);
  }
  const next = addMonths(parseISO(start), 1);
  const end = addDays(startIn(next.y, next.m, startDay), -1);
  return { start, end, days: diffDays(start, end) + 1 };
}

export function shiftCycle(cycle: Cycle, startDay: number, direction: 1 | -1): Cycle {
  return direction > 0
    ? cycleFor(addDays(cycle.end, 1), startDay)
    : cycleFor(addDays(cycle.start, -1), startDay);
}

export function isInCycle(date: ISODate, cycle: Cycle): boolean {
  return date >= cycle.start && date <= cycle.end;
}

/** Data em que uma conta que vence no dia `day` cai dentro do ciclo. */
export function dueDateInCycle(cycle: Cycle, day: number): ISODate {
  const s = parseISO(cycle.start);
  const candidate = toISO(clampDay(s.y, s.m, day));
  if (candidate >= cycle.start) return candidate;
  const n = addMonths(s, 1);
  return toISO(clampDay(n.y, n.m, day));
}

/** Quantos dias do ciclo já passaram (contando hoje), limitado ao tamanho do ciclo. */
export function elapsedDays(cycle: Cycle, today: ISODate): number {
  if (today < cycle.start) return 0;
  if (today > cycle.end) return cycle.days;
  return diffDays(cycle.start, today) + 1;
}
