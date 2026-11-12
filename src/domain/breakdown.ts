import type { Charge } from './charges';
import { merchantKey, normalize } from './text';
import type { Cents, ID, PlanCategory } from './types';

/** Id used for charges whose category no longer exists. */
export const UNCATEGORIZED = '__none__';

export interface MerchantTotal {
  name: string;
  total: Cents;
  count: number;
}

export interface CategorySlice {
  /** Category id, or {@link UNCATEGORIZED}. */
  id: ID;
  name: string;
  color?: string;
  category?: PlanCategory;
  total: Cents;
  count: number;
  /** Share of everything spent (0–1). */
  share: number;
  /** Same category in the previous period, for comparison. */
  previous: Cents;
}

export interface Breakdown {
  total: Cents;
  previousTotal: Cents;
  /** Highest total first; categories without spending are left out. */
  slices: CategorySlice[];
}

/** "Celular (2/10)" -> "Celular": installments belong to the same purchase. */
function purchaseName(description: string): string {
  return description.replace(/\s*\(\d+\/\d+\)$/, '').trim();
}

/**
 * Groups charges by merchant (similar descriptions together: "Uber *trip 123" and
 * "UBER TRIP 456"), highest total first.
 * @param items Charges to group.
 * @param limit How many merchants to keep (the rest is dropped; see {@link topMerchants}).
 */
export function merchantTotals(items: Charge[], limit = Infinity): MerchantTotal[] {
  const groups = new Map<string, MerchantTotal>();
  for (const c of items) {
    const name = purchaseName(c.description);
    const key = merchantKey(name) || normalize(name);
    const g = groups.get(key) ?? { name, total: 0, count: 0 };
    g.total += c.amount;
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || b.count - a.count).slice(0, limit);
}

/**
 * Top merchants plus an "Outros" row with whatever did not fit, so the rows always
 * add up to the total.
 * @param items Charges to group.
 * @param limit Merchant rows before "Outros".
 */
export function topMerchants(items: Charge[], limit = 5): { rows: MerchantTotal[]; others?: MerchantTotal } {
  const all = merchantTotals(items);
  const rows = all.slice(0, limit);
  const rest = all.slice(limit);
  if (!rest.length) return { rows };
  return {
    rows,
    others: {
      name: rest.length === 1 ? rest[0].name : `Outros (${rest.length})`,
      total: rest.reduce((s, m) => s + m.total, 0),
      count: rest.reduce((s, m) => s + m.count, 0),
    },
  };
}

/**
 * Where the money went: spending per category, with its share and the previous
 * period's value.
 * @param charges Charges of the period.
 * @param previous Charges of the previous period (same length), for comparison.
 * @param categories The plan's categories (names, colors, order for ties).
 */
export function categoryBreakdown(charges: Charge[], previous: Charge[], categories: PlanCategory[]): Breakdown {
  const known = new Map(categories.map((c) => [c.id, c]));
  const idOf = (c: Charge) => (known.has(c.categoryId) ? c.categoryId : UNCATEGORIZED);
  const sum = (list: Charge[]) => {
    const out = new Map<ID, { total: Cents; count: number }>();
    for (const c of list) {
      const g = out.get(idOf(c)) ?? { total: 0, count: 0 };
      g.total += c.amount;
      g.count += 1;
      out.set(idOf(c), g);
    }
    return out;
  };
  const now = sum(charges);
  const before = sum(previous);
  const total = charges.reduce((s, c) => s + c.amount, 0);
  const previousTotal = previous.reduce((s, c) => s + c.amount, 0);

  const slices: CategorySlice[] = [...now]
    .filter(([, g]) => g.total > 0)
    .map(([id, g]) => {
      const category = known.get(id);
      return {
        id,
        name: category?.name ?? 'Sem categoria',
        color: category?.color,
        category,
        total: g.total,
        count: g.count,
        share: total > 0 ? g.total / total : 0,
        previous: before.get(id)?.total ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  return { total, previousTotal, slices };
}

/** Charges of one slice of {@link categoryBreakdown}. */
export function chargesOfSlice(charges: Charge[], sliceId: ID, categories: PlanCategory[]): Charge[] {
  if (sliceId !== UNCATEGORIZED) return charges.filter((c) => c.categoryId === sliceId);
  const known = new Set(categories.map((c) => c.id));
  return charges.filter((c) => !known.has(c.categoryId));
}

/**
 * Change versus the previous period, rounded: 0.25 = 25% more, -0.1 = 10% less.
 * `null` when there is nothing to compare with.
 */
export function changeRatio(current: Cents, previous: Cents): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100) / 100;
}
