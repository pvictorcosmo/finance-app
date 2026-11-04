import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useFinanceData } from '@/store/finance-store';

import { notificationsSupported, rescheduleDailySummaries } from './daily-summary';

/** Espera um pouco após mudanças para não reagendar a cada tecla digitada. */
const DEBOUNCE_MS = 1500;

/**
 * Mantém o resumo diário agendado com dados atualizados: reagenda quando os
 * dados ou o horário mudam e quando o app volta para a frente (o "hoje" pode ter mudado).
 */
export function useDailySummaryScheduler(hydrated: boolean) {
  const data = useFinanceData();
  const [foregroundTick, setForegroundTick] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!hydrated || !notificationsSupported) return;
    const timer = setTimeout(() => {
      rescheduleDailySummaries(data, data.settings.dailySummary).catch((err) =>
        console.warn('Falha ao agendar o resumo diário', err),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [hydrated, data, foregroundTick]);
}
