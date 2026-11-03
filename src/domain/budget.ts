import { elapsedDays, isInCycle, type Cycle } from './cycle';
import type { Category, Cents, Expense, FinanceData, ISODate } from './types';

export type CategoryHealth = 'ok' | 'attention' | 'over' | 'unset';

export interface CategoryStatus {
  category: Category;
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
  fixed: Cents;
  /** Salário menos contas fixas: o que sobra para as categorias. */
  free: Cents;
  /** Soma dos limites das categorias. */
  allocated: Cents;
  /** Livre que não foi distribuído em nenhuma categoria (negativo = distribuiu demais). */
  unallocated: Cents;
  spent: Cents;
  /** Gastos sem categoria válida (ex.: categoria apagada). */
  uncategorized: Cents;
  /** Fração do ciclo que já passou (0–1). */
  progress: number;
  daysLeft: number;
  categories: CategoryStatus[];
}

/** Margem de tolerância antes de avisar que está acima do ritmo. */
const PACE_TOLERANCE = 1.1;

export function categoryLimit(category: Pick<Category, 'limitType' | 'limitValue'>, free: Cents): Cents {
  return category.limitType === 'amount'
    ? category.limitValue
    : Math.max(0, Math.round((free * category.limitValue) / 100));
}

export function expensesInCycle(expenses: Expense[], cycle: Cycle): Expense[] {
  return expenses.filter((e) => isInCycle(e.date, cycle));
}

export function computeBudget(data: FinanceData, cycle: Cycle, today: ISODate): Budget {
  const salary = data.settings.salary;
  const fixed = data.fixedBills.reduce((sum, b) => sum + b.amount, 0);
  const free = salary - fixed;

  const elapsed = elapsedDays(cycle, today);
  const progress = elapsed / cycle.days;
  const daysLeft = Math.max(1, cycle.days - elapsed + 1);

  const spentBy = new Map<string, Cents>();
  let spent = 0;
  for (const e of expensesInCycle(data.expenses, cycle)) {
    spentBy.set(e.categoryId, (spentBy.get(e.categoryId) ?? 0) + e.amount);
    spent += e.amount;
  }

  const categories = data.categories.map((category): CategoryStatus => {
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
  const known = new Set(data.categories.map((c) => c.id));
  const uncategorized = [...spentBy].reduce((sum, [id, v]) => (known.has(id) ? sum : sum + v), 0);

  return {
    salary,
    fixed,
    free,
    allocated,
    unallocated: free - allocated,
    spent,
    uncategorized,
    progress,
    daysLeft,
    categories,
  };
}
