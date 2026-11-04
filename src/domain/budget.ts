import { allCharges, type Charge } from './charges';
import { dueDateInCycle, elapsedDays, isInCycle, type Cycle } from './cycle';
import { parseISO } from './dates';
import type { Cents, FinanceData, Income, ISODate, PlanCategory } from './types';

export type CategoryHealth = 'ok' | 'attention' | 'over' | 'unset';

export interface CategoryStatus {
  category: PlanCategory;
  limit: Cents;
  spent: Cents;
  /** Quanto seria "normal" já ter gasto até hoje, no ritmo do ciclo. */
  expected: Cents;
  remaining: Cents;
  /** Quanto ainda dá para gastar por dia até o fim do ciclo. */
  perDayLeft: Cents;
  health: CategoryHealth;
}

export interface Budget {
  salary: Cents;
  /** Renda extra do ciclo que soma no valor livre. */
  extraIncome: Cents;
  /** Renda extra do ciclo que vai direto para a poupança. */
  directSavings: Cents;
  fixed: Cents;
  /** Salário + renda extra − contas fixas: o que sobra para as categorias. */
  free: Cents;
  /** Soma dos limites das categorias. */
  allocated: Cents;
  /** Livre que não foi distribuído em nenhuma categoria (negativo = distribuiu demais). */
  unallocated: Cents;
  spent: Cents;
  /** Livre − gasto. Quando o ciclo fecha, isso vai para a poupança (negativo tira da poupança). */
  leftover: Cents;
  /** Gastos sem categoria válida (ex.: categoria apagada). */
  uncategorized: Cents;
  /** Fração do ciclo que já passou (0–1). */
  progress: number;
  daysLeft: number;
  categories: CategoryStatus[];
  /** Cobranças (gastos e parcelas) que caem neste ciclo. */
  charges: Charge[];
}

export interface CyclePlan {
  salary: Cents;
  fixed: Cents;
  categories: PlanCategory[];
  fromSnapshot: boolean;
}

/** Margem de tolerância antes de avisar que está acima do ritmo. */
const PACE_TOLERANCE = 1.1;

export function categoryLimit(category: Pick<PlanCategory, 'limitType' | 'limitValue'>, free: Cents): Cents {
  return category.limitType === 'amount'
    ? category.limitValue
    : Math.max(0, Math.round((free * category.limitValue) / 100));
}

/** Planejamento atual (salário, fixas, categorias), do jeito que está configurado agora. */
export function livePlan(data: FinanceData): CyclePlan {
  return {
    salary: data.settings.salary,
    fixed: data.fixedBills.reduce((sum, b) => sum + b.amount, 0),
    categories: data.categories.map(({ id, name, color, icon, limitType, limitValue }) => ({
      id,
      name,
      color,
      icon,
      limitType,
      limitValue,
    })),
    fromSnapshot: false,
  };
}

/** Planejamento de um ciclo: a "foto" salva quando ele fechou, ou o atual. */
export function planFor(data: FinanceData, cycle: Cycle): CyclePlan {
  const snap = data.snapshots.find((s) => s.start === cycle.start);
  return snap
    ? { salary: snap.salary, fixed: snap.fixed, categories: snap.categories, fromSnapshot: true }
    : livePlan(data);
}

/** Data em que uma renda cai no ciclo (ou null se não cai). */
export function incomeDateInCycle(income: Income, cycle: Cycle): ISODate | null {
  if (income.recurrence === 'once') return isInCycle(income.date, cycle) ? income.date : null;
  const date = dueDateInCycle(cycle, parseISO(income.date).d);
  if (date < income.date) return null;
  if (income.endDate && date > income.endDate) return null;
  return date;
}

export function incomesInCycle(incomes: Income[], cycle: Cycle) {
  let toBudget = 0;
  let toSavings = 0;
  const items: { income: Income; date: ISODate }[] = [];
  for (const income of incomes) {
    const date = incomeDateInCycle(income, cycle);
    if (!date) continue;
    items.push({ income, date });
    if (income.destination === 'savings') toSavings += income.amount;
    else toBudget += income.amount;
  }
  return { toBudget, toSavings, items };
}

export function chargesInCycle(charges: Charge[], cycle: Cycle): Charge[] {
  return charges.filter((c) => isInCycle(c.date, cycle));
}

export function computeBudget(
  data: FinanceData,
  cycle: Cycle,
  today: ISODate,
  charges: Charge[] = allCharges(data.expenses, data.cards),
): Budget {
  const plan = planFor(data, cycle);
  const extras = incomesInCycle(data.incomes, cycle);
  const free = plan.salary + extras.toBudget - plan.fixed;

  const elapsed = elapsedDays(cycle, today);
  const progress = elapsed / cycle.days;
  const daysLeft = Math.max(1, cycle.days - elapsed + 1);

  const cycleCharges = chargesInCycle(charges, cycle);
  const spentBy = new Map<string, Cents>();
  let spent = 0;
  for (const c of cycleCharges) {
    spentBy.set(c.categoryId, (spentBy.get(c.categoryId) ?? 0) + c.amount);
    spent += c.amount;
  }

  const categories = plan.categories.map((category): CategoryStatus => {
    const limit = categoryLimit(category, free);
    const catSpent = spentBy.get(category.id) ?? 0;
    const expected = Math.round(limit * progress);
    const remaining = limit - catSpent;

    let health: CategoryHealth = 'ok';
    if (limit <= 0) health = catSpent > 0 ? 'over' : 'unset';
    else if (catSpent > limit) health = 'over';
    else if (catSpent > expected * PACE_TOLERANCE) health = 'attention';

    return {
      category,
      limit,
      spent: catSpent,
      expected,
      remaining,
      perDayLeft: Math.max(0, Math.floor(remaining / daysLeft)),
      health,
    };
  });

  const allocated = categories.reduce((sum, c) => sum + c.limit, 0);
  const known = new Set(plan.categories.map((c) => c.id));
  const uncategorized = [...spentBy].reduce((sum, [id, v]) => (known.has(id) ? sum : sum + v), 0);

  return {
    salary: plan.salary,
    extraIncome: extras.toBudget,
    directSavings: extras.toSavings,
    fixed: plan.fixed,
    free,
    allocated,
    unallocated: free - allocated,
    spent,
    leftover: free - spent,
    uncategorized,
    progress,
    daysLeft,
    categories,
    charges: cycleCharges,
  };
}
