import type { PaymentKey } from './payment';
import type { ImportCandidate, ParsedStatement } from './statement';
import { suggestByKeywords, suggestFromHistory, type HistoryIndex } from './suggestions';
import { merchantKey, normalize } from './text';
import type { Category, Cents, CreditCard, Expense, ID, ISODate } from './types';

/** How a row got its category, shown to the user during review. */
export type CategorySource = 'history' | 'keyword' | 'ai' | 'manual';

/** One statement line under review before being imported as an expense. */
export interface ImportRow {
  key: string;
  date: ISODate;
  description: string;
  /** Description exactly as it came from the bank. */
  originalDescription: string;
  value: Cents;
  /** Stable id used to skip the same line on a later import. */
  externalId: string;
  /** Merchant key used to group similar lines. */
  merchant: string;
  include: boolean;
  categoryId?: ID;
  categorySource?: CategorySource;
  /** Already registered in the app (same id, or same date + value + merchant). */
  duplicate: boolean;
}

/**
 * Builds the review list: detects duplicates and pre-fills categories from the
 * user's history first and keyword rules second.
 * @param candidates Expense lines from the statement.
 * @param expenses Expenses already in the app.
 * @param categories User categories.
 * @param index History index built from the user's expenses.
 * @returns Rows ready for review; duplicates start unchecked.
 */
export function buildImportRows(
  candidates: ImportCandidate[],
  expenses: Expense[],
  categories: Pick<Category, 'id' | 'name'>[],
  index: HistoryIndex,
): ImportRow[] {
  const known = new Set(expenses.map((e) => e.externalId).filter(Boolean));
  const fingerprints = new Set(expenses.map((e) => `${e.date}|${e.amount}|${merchantKey(e.description)}`));
  const seen = new Map<string, number>();

  return candidates.map((c, i) => {
    const merchant = merchantKey(c.description);
    const fingerprint = `${c.date}|${c.value}|${merchant}`;
    // Same purchase twice on the same day is possible: number repeated fingerprints.
    const n = (seen.get(fingerprint) ?? 0) + 1;
    seen.set(fingerprint, n);
    const externalId = c.externalId ?? (n > 1 ? `${fingerprint}#${n}` : fingerprint);
    const duplicate = known.has(externalId) || (n === 1 && fingerprints.has(fingerprint));

    let categoryId: ID | undefined;
    let categorySource: CategorySource | undefined;
    const fromHistory = suggestFromHistory(index, c.description);
    if (fromHistory && categories.some((cat) => cat.id === fromHistory.categoryId)) {
      categoryId = fromHistory.categoryId;
      categorySource = 'history';
    } else {
      categoryId = suggestByKeywords(c.description, categories);
      if (categoryId) categorySource = 'keyword';
    }

    return {
      key: `${i}`,
      date: c.date,
      description: fromHistory?.description ?? tidy(c.description),
      originalDescription: c.description,
      value: c.value,
      externalId,
      merchant,
      include: !duplicate,
      categoryId,
      categorySource,
      duplicate,
    };
  });
}

/** "UBER   *TRIP" -> "Uber *trip": collapses spaces and fixes ALL CAPS. */
function tidy(description: string): string {
  const compact = description.replace(/\s+/g, ' ').trim();
  if (compact !== compact.toUpperCase()) return compact;
  const lower = compact.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Sets a row's category and propagates it to similar rows (same merchant) that the
 * user has not set by hand.
 * @param rows Current rows.
 * @param key Row the user changed.
 * @param categoryId Chosen category.
 * @returns Updated rows.
 */
export function setRowCategory(rows: ImportRow[], key: string, categoryId: ID): ImportRow[] {
  const target = rows.find((r) => r.key === key);
  if (!target) return rows;
  return rows.map((r) => {
    if (r.key === key) return { ...r, categoryId, categorySource: 'manual' };
    if (target.merchant && r.merchant === target.merchant && r.categorySource !== 'manual') {
      return { ...r, categoryId, categorySource: 'manual' };
    }
    return r;
  });
}

/**
 * Picks the most likely payment method for the whole file: the matching card for
 * credit card statements, debit for bank accounts.
 * @param parsed Parsed statement (kind and bank hints).
 * @param cards User cards.
 */
export function defaultImportPayment(parsed: Pick<ParsedStatement, 'kind' | 'bank'>, cards: Pick<CreditCard, 'id' | 'name'>[]): PaymentKey {
  if (parsed.kind === 'account') return 'debit';
  const bank = parsed.bank ? normalize(parsed.bank) : '';
  const match = bank
    ? cards.find((c) => normalize(c.name).includes(bank.split(' ')[0]) || bank.includes(normalize(c.name)))
    : undefined;
  if (match) return `credit:${match.id}`;
  if (parsed.kind === 'card' && cards[0]) return `credit:${cards[0].id}`;
  return 'debit';
}
