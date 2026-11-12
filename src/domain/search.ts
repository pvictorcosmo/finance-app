import { merchantTotals, type MerchantTotal } from './breakdown';
import type { Charge } from './charges';
import { cycleFor } from './cycle';
import { addDays, addMonthsISO, MONTHS_SHORT, parseISO } from './dates';
import { parseMoney } from './money';
import { paymentLabel, paymentToKey, type PaymentKey } from './payment';
import { normalize } from './text';
import type { Cents, FinanceData, ID, ISODate } from './types';

export type { MerchantTotal };

/** Period presets of the statement screen. */
export type PeriodPreset = 'cycle' | '3m' | '6m' | '12m' | 'all';

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  cycle: 'Este mês',
  '3m': '3 meses',
  '6m': '6 meses',
  '12m': '12 meses',
  all: 'Tudo',
};

export interface SearchFilters {
  /** Free text: words, plus value expressions such as "acima de 100" or "50-200". */
  query: string;
  period: PeriodPreset;
  /** Empty = any category. */
  categoryIds: ID[];
  /** Empty = any payment method. */
  paymentKeys: PaymentKey[];
  /** Extra value range set through the filter panel (cents). */
  minAmount?: Cents;
  maxAmount?: Cents;
}

export const EMPTY_FILTERS: SearchFilters = {
  query: '',
  period: '3m',
  categoryIds: [],
  paymentKeys: [],
};

/** Words and value range understood from the search text. */
export interface ParsedQuery {
  terms: string[];
  min?: Cents;
  max?: Cents;
}

const NUM = String.raw`(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;

/**
 * Splits the search text into words and an optional value range.
 * Understands "acima de 100", "> 100", "abaixo de 50", "< 50", "50-200",
 * "entre 50 e 200" and an exact value like "45,90".
 * @param query Text typed by the user.
 */
export function parseQuery(query: string): ParsedQuery {
  let text = ` ${normalize(query)} `;
  let min: Cents | undefined;
  let max: Cents | undefined;
  const take = (re: RegExp, apply: (m: RegExpMatchArray) => void) => {
    const m = text.match(re);
    if (m) {
      apply(m);
      text = text.replace(m[0], ' ');
    }
  };
  const money = (s: string) => parseMoney(s) ?? undefined;

  take(new RegExp(String.raw`\s(?:entre|de)\s+${NUM}\s+(?:e|a|ate)\s+${NUM}\s`), (m) => {
    min = money(m[1]);
    max = money(m[2]);
  });
  take(new RegExp(String.raw`\s${NUM}\s*(?:-|a|ate)\s*${NUM}\s`), (m) => {
    min = money(m[1]);
    max = money(m[2]);
  });
  take(new RegExp(String.raw`\s(?:acima de|maior que|mais de|>=?)\s*${NUM}\s`), (m) => {
    min = money(m[1]);
  });
  take(new RegExp(String.raw`\s(?:abaixo de|menor que|menos de|ate|<=?)\s*${NUM}\s`), (m) => {
    max = money(m[1]);
  });
  if (min === undefined && max === undefined) {
    take(new RegExp(String.raw`\s${NUM}\s`), (m) => {
      min = max = money(m[1]);
    });
  }
  const terms = text.split(' ').filter((t) => t && !['r$', 'reais', 'real'].includes(t));
  return { terms, min, max };
}

/**
 * Date range of a period preset. Ranges end at the end of the current cycle, so
 * installments scheduled for the rest of the month are included.
 * @param period Preset.
 * @param today Reference date.
 * @param cycleStartDay Day the financial month starts.
 * @returns Inclusive `from`/`to` dates (`from` undefined = no lower bound).
 */
export function periodRange(period: PeriodPreset, today: ISODate, cycleStartDay: number): { from?: ISODate; to: ISODate } {
  const cycle = cycleFor(today, cycleStartDay);
  const months = { cycle: 0, '3m': 3, '6m': 6, '12m': 12, all: -1 }[period];
  if (months === -1) return { to: cycle.end };
  if (months === 0) return { from: cycle.start, to: cycle.end };
  return { from: addDays(addMonthsISO(today, -months), 1), to: cycle.end };
}

export interface MonthTotal {
  /** "2026-11" */
  key: string;
  /** "nov" */
  label: string;
  total: Cents;
}


export interface SearchResult {
  /** Matching charges, newest first. */
  items: Charge[];
  total: Cents;
  count: number;
  average: Cents;
  /** Monthly totals (oldest first), at most the last 12 months of the range. */
  byMonth: MonthTotal[];
  /** Merchants with the highest totals. */
  topMerchants: MerchantTotal[];
  /** True when the user is filtering by anything (shows the analysis). */
  filtered: boolean;
}

/**
 * Searches purchases (each installment is its own charge, on its own date).
 * @param data App data (categories and cards give names to match).
 * @param charges Purchases expanded into charges.
 * @param filters Search text and filters.
 * @param today Reference date.
 */
export function searchCharges(data: FinanceData, charges: Charge[], filters: SearchFilters, today: ISODate): SearchResult {
  const { terms, min: qMin, max: qMax } = parseQuery(filters.query);
  const min = Math.max(qMin ?? -Infinity, filters.minAmount ?? -Infinity);
  const max = Math.min(qMax ?? Infinity, filters.maxAmount ?? Infinity);
  const { from, to } = periodRange(filters.period, today, data.settings.cycleStartDay);
  const categoryName = new Map(data.categories.map((c) => [c.id, c.name]));

  const items = charges
    .filter((c) => (!from || c.date >= from) && c.date <= to)
    .filter((c) => c.amount >= min && c.amount <= max)
    .filter((c) => !filters.categoryIds.length || filters.categoryIds.includes(c.categoryId))
    .filter((c) => !filters.paymentKeys.length || filters.paymentKeys.includes(paymentToKey(c.payment)))
    .filter((c) => {
      if (!terms.length) return true;
      const haystack = normalize(
        `${c.description} ${categoryName.get(c.categoryId) ?? ''} ${paymentLabel(c.payment, data.cards)}`,
      );
      return terms.every((t) => haystack.includes(t));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);

  const total = items.reduce((s, c) => s + c.amount, 0);
  return {
    items,
    total,
    count: items.length,
    average: items.length ? Math.round(total / items.length) : 0,
    byMonth: monthTotals(items, from, to),
    topMerchants: merchantTotals(items, 3),
    filtered:
      terms.length > 0 ||
      qMin !== undefined ||
      qMax !== undefined ||
      filters.minAmount !== undefined ||
      filters.maxAmount !== undefined ||
      filters.categoryIds.length > 0 ||
      filters.paymentKeys.length > 0,
  };
}

/** Totals per month, including empty months, limited to the last 12 months of the range. */
function monthTotals(items: Charge[], from: ISODate | undefined, to: ISODate): MonthTotal[] {
  const totals = new Map<string, Cents>();
  for (const c of items) totals.set(c.date.slice(0, 7), (totals.get(c.date.slice(0, 7)) ?? 0) + c.amount);
  const firstKey = from?.slice(0, 7) ?? [...totals.keys()].sort()[0] ?? to.slice(0, 7);
  const months: MonthTotal[] = [];
  let { y, m } = parseISO(`${firstKey}-01`);
  const end = to.slice(0, 7);
  for (let guard = 0; guard < 240; guard++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (key > end) break;
    months.push({ key, label: MONTHS_SHORT[m - 1], total: totals.get(key) ?? 0 });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months.slice(-12);
}
