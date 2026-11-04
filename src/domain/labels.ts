import type { IncomeKind } from './types';

export const INCOME_KINDS: { value: IncomeKind; label: string }[] = [
  { value: 'freela', label: 'Freela' },
  { value: 'thirteenth', label: '13º salário' },
  { value: 'meal', label: 'Vale-refeição' },
  { value: 'bonus', label: 'Bônus / PLR' },
  { value: 'other', label: 'Outro' },
];

export function incomeKindLabel(kind: IncomeKind): string {
  return INCOME_KINDS.find((k) => k.value === kind)?.label ?? 'Renda';
}
