import type { CreditCard, PaymentMethod } from './types';

/**
 * Codifica a forma de pagamento como string para usar em seletores:
 * 'debit' | 'pix' | 'cash' | 'credit:<cardId>'.
 */
export type PaymentKey = string;

export function paymentToKey(p: PaymentMethod): PaymentKey {
  return p.kind === 'credit' ? `credit:${p.cardId}` : p.kind;
}

export function keyToPayment(key: PaymentKey): PaymentMethod {
  if (key.startsWith('credit:')) return { kind: 'credit', cardId: key.slice(7) };
  if (key === 'pix' || key === 'cash') return { kind: key };
  return { kind: 'debit' };
}

export function paymentLabel(p: PaymentMethod, cards: CreditCard[]): string {
  switch (p.kind) {
    case 'credit':
      return cards.find((c) => c.id === p.cardId)?.name ?? 'Cartão removido';
    case 'debit':
      return 'Débito';
    case 'pix':
      return 'Pix';
    case 'cash':
      return 'Dinheiro';
  }
}

export function paymentOptions(cards: CreditCard[]) {
  return [
    ...cards.map((c) => ({ value: `credit:${c.id}`, label: c.name, color: c.color })),
    { value: 'debit', label: 'Débito' },
    { value: 'pix', label: 'Pix' },
    { value: 'cash', label: 'Dinheiro' },
  ];
}
