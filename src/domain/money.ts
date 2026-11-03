import type { Cents } from './types';

/** 123456 -> "R$ 1.234,56" */
export function formatBRL(cents: Cents): string {
  const neg = cents < 0;
  const abs = Math.round(Math.abs(cents));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const c = String(abs % 100).padStart(2, '0');
  return `${neg ? '-' : ''}R$ ${reais},${c}`;
}

/**
 * Converte o que o usuário digitou em centavos.
 * Aceita "12,50", "12.50", "1.234,56", "1234" etc. Retorna null se inválido.
 */
export function parseMoney(input: string): Cents | null {
  const cleaned = input.replace(/[^\d,.]/g, '');
  if (!cleaned) return null;
  const decimal = cleaned.match(/^(.*)[.,](\d{1,2})$/);
  const normalized = decimal
    ? `${decimal[1].replace(/[.,]/g, '')}.${decimal[2]}`
    : cleaned.replace(/[.,]/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** 1250 -> "12,50" (para preencher campos de edição) */
export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
