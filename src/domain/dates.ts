import type { ISODate } from './types';

export interface YMD {
  y: number;
  /** 1–12 */
  m: number;
  d: number;
}
export interface YM {
  y: number;
  m: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WEEKDAYS_SHORT =['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function toISO({ y, m, d }: YMD): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseISO(iso: ISODate): YMD {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function todayISO(): ISODate {
  const n = new Date();
  return toISO({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() });
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Dia `d` do mês, usando o último dia quando o mês é mais curto (ex.: 31 em fevereiro). */
export function clampDay(y: number, m: number, d: number): YMD {
  return { y, m, d: Math.min(d, daysInMonth(y, m)) };
}

export function addMonths({ y, m }: YM, n: number): YM {
  const t = y * 12 + (m - 1) + n;
  return { y: Math.floor(t / 12), m: (((t % 12) + 12) % 12) + 1 };
}

/** Mesma data `n` meses depois (usa o último dia em meses mais curtos). */
export function addMonthsISO(iso: ISODate, n: number): ISODate {
  const p = parseISO(iso);
  const ym = addMonths(p, n);
  return toISO(clampDay(ym.y, ym.m, p.d));
}

/** "nov/26" */
export function formatMonthYear(iso: ISODate): string {
  const { y, m } = parseISO(iso);
  return `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`;
}

function toUTC(iso: ISODate): number {
  const { y, m, d } = parseISO(iso);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const dt = new Date(toUTC(iso) + n * 86_400_000);
  return toISO({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

/** Número de dias de `a` até `b` (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

/** 0 = domingo. */
export function weekday(iso: ISODate): number {
  return new Date(toUTC(iso)).getUTCDay();
}

/** "05/11" */
export function formatShort(iso: ISODate): string {
  const { m, d } = parseISO(iso);
  return `${pad(d)}/${pad(m)}`;
}

/** "qua, 5 de novembro" */
export function formatLong(iso: ISODate): string {
  const { m, d } = parseISO(iso);
  return `${WEEKDAYS[weekday(iso)]}, ${d} de ${MONTHS[m - 1].toLowerCase()}`;
}

/** "Hoje", "Amanhã", "em 3 dias", "há 2 dias" */
export function relativeDays(iso: ISODate, today: ISODate = todayISO()): string {
  const n = diffDays(today, iso);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
}
