import { useMemo, useState } from 'react';

import { cycleFor, shiftCycle } from '@/domain/cycle';
import { todayISO } from '@/domain/dates';
import { useFinance } from '@/store/finance-store';

/** Ciclo financeiro atual, com navegação para ciclos anteriores/próximos. */
export function useCycleNavigator() {
  const startDay = useFinance((s) => s.settings.cycleStartDay);
  const [offset, setOffset] = useState(0);
  const today = todayISO();

  const cycle = useMemo(() => {
    let c = cycleFor(today, startDay);
    for (let i = 0; i < Math.abs(offset); i++) c = shiftCycle(c, startDay, offset > 0 ? 1 : -1);
    return c;
  }, [today, startDay, offset]);

  return { cycle, offset, setOffset, today, isCurrent: offset === 0 };
}
