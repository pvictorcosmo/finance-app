import { todayISO } from './dates';
import type { FinanceData } from './types';

/** Cores da primeira versão do app -> cor equivalente da paleta nova. */
const LEGACY_COLORS: Record<string, string> = {
  '#208AEF': '#2a78d6',
  '#30A46C': '#1baf7a',
  '#F76B15': '#eb6834',
  '#E5484D': '#e34948',
  '#8E4EC6': '#6250d6',
  '#D6409F': '#e87ba4',
  '#12A594': '#008300',
  '#FFB224': '#eda100',
  '#6E56CF': '#6250d6',
  '#5B5BD6': '#2a78d6',
};

/**
 * Versão atual do formato dos dados. Suba este número (e adicione um passo abaixo)
 * sempre que o formato salvo mudar.
 */
export const DATA_VERSION = 3;

/**
 * Atualiza dados salvos numa versão antiga para o formato atual.
 * Usado ao abrir o app (dados do aparelho) e ao importar um backup.
 */
export function migrateData(raw: unknown, fromVersion: number): FinanceData {
  const data = { ...(raw as FinanceData) };

  if (fromVersion < 2) {
    const recolor = <T extends { color: string }>(x: T): T => ({ ...x, color: LEGACY_COLORS[x.color] ?? x.color });
    data.settings = { ...data.settings, startedAt: data.settings.startedAt ?? todayISO() };
    data.categories = (data.categories ?? []).map(recolor);
    data.cards = (data.cards ?? []).map(recolor);
    data.incomes ??= [];
    data.receivables ??= [];
    data.invoicePaid ??= {};
    data.snapshots ??= [];
  }
  if (fromVersion < 3) {
    data.agreements ??= [];
  }
  return data;
}
