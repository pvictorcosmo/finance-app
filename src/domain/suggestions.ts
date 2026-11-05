import { paymentToKey, type PaymentKey } from './payment';
import { merchantKey, normalize } from './text';
import type { Category, Cents, Expense, ID } from './types';

/**
 * Aprende com o histórico: para cada descrição/estabelecimento, qual categoria e
 * forma de pagamento você costuma usar. Base do autocompletar, do chat e da importação.
 */
export interface HistoryEntry {
  /** Descrição como você escreveu da última vez. */
  description: string;
  categoryId: ID;
  paymentKey: PaymentKey;
  lastAmount: Cents;
  count: number;
  lastDate: string;
}

export type HistoryIndex = Map<string, HistoryEntry>;

/** Índice por chave de estabelecimento; vale a escolha mais frequente (empate: a mais recente). */
export function buildHistoryIndex(expenses: Expense[]): HistoryIndex {
  const votes = new Map<string, Map<string, HistoryEntry>>();
  for (const e of expenses) {
    const key = merchantKey(e.description);
    if (!key) continue;
    const combo = `${e.categoryId}|${paymentToKey(e.payment)}`;
    const byCombo = votes.get(key) ?? new Map<string, HistoryEntry>();
    const prev = byCombo.get(combo);
    const newer = !prev || e.date >= prev.lastDate;
    byCombo.set(combo, {
      description: newer ? e.description : prev!.description,
      categoryId: e.categoryId,
      paymentKey: paymentToKey(e.payment),
      lastAmount: newer ? e.amount : prev!.lastAmount,
      count: (prev?.count ?? 0) + 1,
      lastDate: newer ? e.date : prev!.lastDate,
    });
    votes.set(key, byCombo);
  }
  const index: HistoryIndex = new Map();
  for (const [key, byCombo] of votes) {
    const best = [...byCombo.values()].sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))[0];
    const total = [...byCombo.values()].reduce((s, x) => s + x.count, 0);
    index.set(key, { ...best, count: total });
  }
  return index;
}

/** Melhor palpite para uma descrição: mesmo estabelecimento, ou o que começa igual. */
export function suggestFromHistory(index: HistoryIndex, description: string): HistoryEntry | undefined {
  const key = merchantKey(description);
  if (!key) return undefined;
  const exact = index.get(key);
  if (exact) return exact;
  const first = key.split(' ')[0];
  if (first.length < 3) return undefined;
  let best: HistoryEntry | undefined;
  for (const [k, entry] of index) {
    if ((k === first || k.startsWith(`${first} `)) && (!best || entry.count > best.count)) best = entry;
  }
  return best;
}

/** Descrições já usadas que combinam com o que está sendo digitado (para autocompletar). */
export function autocomplete(index: HistoryIndex, typed: string, limit = 4): HistoryEntry[] {
  const q = normalize(typed);
  if (q.length < 2) return [];
  return [...index.values()]
    .filter((e) => normalize(e.description).includes(q) && normalize(e.description) !== q)
    .sort((a, b) => Number(normalize(b.description).startsWith(q)) - Number(normalize(a.description).startsWith(q)) || b.count - a.count)
    .slice(0, limit);
}

/**
 * Palavras-chave comuns -> tipo de categoria. Usado quando o histórico não sabe:
 * procura uma categoria sua cujo nome bata com o tipo (ex.: "uber" -> sua categoria "Uber"/"Transporte").
 */
const KEYWORD_GROUPS: { words: RegExp; names: RegExp }[] = [
  { words: /\b(uber|99|99app|99pop|taxi|cabify|indriver|metro|onibus|bilhete unico|estacionamento|sem parar|veloe|posto|shell|ipiranga|petrobras|br mania|combustivel|gasolina)\b/, names: /uber|transporte|carro|mobilidade|gasolina|combust/ },
  { words: /\b(ifood|rappi|restaurante|lanchonete|almoco|lanche|burger|mcdonald|bk|subway|pizzaria|pizza|padaria|cafe|cafeteria|starbucks|bar e restaurante|refeicao|marmita|outback|habibs|spoleto)\b/, names: /almoco|comida|alimentacao|restaurante|refeicao|lanche/ },
  // Saúde antes de mercado: farmácia vai para "Saúde" se existir; senão cai em "Dia a dia" abaixo.
  { words: /\b(academia|smartfit|smart fit|bluefit|crossfit|drogaria|farmacia|drogasil|droga raia|raia|pague menos|panvel|consulta|clinica|hospital|laboratorio|dentista|unimed)\b/, names: /saude|academia|bem estar|farmacia/ },
  { words: /\b(mercado|supermercado|atacadao|assai|carrefour|pao de acucar|hortifruti|sacolao|feira|drogaria|farmacia|drogasil|raia|pague menos|panvel|americanas|magalu|shopee|amazon|mercadolivre|mercado livre|aliexpress|shein|tomada|utilidades)\b/, names: /dia a dia|mercado|casa|compras|essencial|basico/ },
  { words: /\b(cinema|cinemark|ingresso|sympla|eventim|show|bar|balada|boteco|cervejaria|netflix|spotify|disney|hbo|prime video|steam|playstation|xbox|nintendo|game|viagem|hotel|airbnb|booking)\b/, names: /lazer|saida|diversao|entretenimento|role/ },
];

export function suggestByKeywords(description: string, categories: Pick<Category, 'id' | 'name'>[]): ID | undefined {
  const text = normalize(description);
  for (const group of KEYWORD_GROUPS) {
    if (!group.words.test(text)) continue;
    const match = categories.find((c) => group.names.test(normalize(c.name)));
    if (match) return match.id;
  }
  return undefined;
}

/** Gastos para o botão "repetir": os mais frequentes, um por estabelecimento. */
export function frequentEntries(index: HistoryIndex, limit = 6): HistoryEntry[] {
  return [...index.values()]
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit);
}
