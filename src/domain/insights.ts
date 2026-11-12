import type { Breakdown } from './breakdown';
import type { Budget } from './budget';
import type { Cycle } from './cycle';
import { addDays, formatShort } from './dates';
import { formatBRL } from './money';
import type { Cents, ISODate } from './types';

export type InsightTone = 'success' | 'warning' | 'danger' | 'accent';

export interface Insight {
  id: string;
  tone: InsightTone;
  text: string;
}

/** Days into the cycle before pace projections are trusted (avoids noise on day 1). */
const MIN_DAYS_FOR_PACE = 3;
/** Changes smaller than this (in cents) are not worth a message. */
const MIN_DELTA: Cents = 5000;

/**
 * Short sentences about the running cycle, most urgent first: categories over the
 * limit, categories that will run out at the current pace, the biggest changes
 * versus the previous cycle (same day) and, when all is fine, the expected leftover.
 * @param budget Budget of the cycle.
 * @param breakdown Spending per category with the previous cycle's values.
 * @param cycle The running cycle.
 * @param today Reference date.
 * @param money Money formatter (lets the screen hide values).
 * @param max Maximum number of sentences.
 */
export function buildInsights(
  budget: Budget,
  breakdown: Breakdown,
  cycle: Cycle,
  today: ISODate,
  money: (cents: Cents) => string = formatBRL,
  max = 3,
): Insight[] {
  const out: Insight[] = [];
  const elapsed = Math.round(budget.progress * cycle.days);
  const paceReady = elapsed >= MIN_DAYS_FOR_PACE && today <= cycle.end;

  // 1. Already over the limit.
  for (const c of budget.categories) {
    if (c.health === 'over' && c.limit > 0) {
      out.push({ id: `over-${c.category.id}`, tone: 'danger', text: `${c.category.name} já passou ${money(-c.remaining)} do limite.` });
    }
  }

  // 2. Will run out before the end of the cycle at the current pace.
  if (paceReady) {
    const runOut = budget.categories
      .filter((c) => c.limit > 0 && c.spent > 0 && c.health !== 'over')
      .map((c) => {
        const perDay = c.spent / elapsed;
        const day = Math.ceil(c.limit / perDay);
        return { c, day };
      })
      .filter(({ day }) => day < cycle.days)
      .sort((a, b) => a.day - b.day);
    for (const { c, day } of runOut) {
      out.push({
        id: `pace-${c.category.id}`,
        tone: 'warning',
        text: `No ritmo atual, ${c.category.name} estoura dia ${formatShort(addDays(cycle.start, day - 1))}.`,
      });
    }
  }

  // 3. Biggest rise and biggest drop versus the previous cycle up to the same day.
  const changes = breakdown.slices
    .filter((s) => s.category && s.previous > 0)
    .map((s) => ({ s, delta: s.total - s.previous, ratio: (s.total - s.previous) / s.previous }));
  const rise = changes.filter((x) => x.ratio >= 0.3 && x.delta >= MIN_DELTA).sort((a, b) => b.delta - a.delta)[0];
  if (rise) {
    out.push({
      id: `rise-${rise.s.id}`,
      tone: 'accent',
      text: `Você gastou ${Math.round(rise.ratio * 100)}% a mais com ${rise.s.name} que no ciclo anterior até hoje.`,
    });
  }
  const drops = breakdown.slices
    .filter((s) => s.category && s.previous >= MIN_DELTA)
    .map((s) => ({ s, delta: s.previous - s.total, ratio: (s.previous - s.total) / s.previous }))
    .filter((x) => x.ratio >= 0.2 && x.delta >= MIN_DELTA)
    .sort((a, b) => b.delta - a.delta);
  if (drops[0]) {
    out.push({
      id: `drop-${drops[0].s.id}`,
      tone: 'success',
      text: `Você gastou ${Math.round(drops[0].ratio * 100)}% a menos com ${drops[0].s.name} que no ciclo anterior até hoje 👏`,
    });
  }

  // 4. Overall: expected leftover when the month is on track.
  if (paceReady && budget.free > 0 && budget.progress > 0) {
    const projected = Math.round(budget.spent / budget.progress);
    const leftover = budget.free - projected;
    if (leftover > 0 && !out.some((i) => i.tone === 'danger')) {
      out.push({ id: 'leftover', tone: 'success', text: `No ritmo atual, sobram cerca de ${money(leftover)} no fim do ciclo.` });
    } else if (leftover < 0 && budget.leftover > 0) {
      out.push({ id: 'leftover', tone: 'warning', text: `No ritmo atual, o mês fecha ${money(-leftover)} acima do livre.` });
    }
  }

  return out.slice(0, max);
}
