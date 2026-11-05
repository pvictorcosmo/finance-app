import { addDays, clampDay, parseISO, toISO } from './dates';
import { parseMoney } from './money';
import type { PaymentKey } from './payment';
import { suggestByKeywords, suggestFromHistory, type HistoryIndex } from './suggestions';
import { normalize } from './text';
import type { Category, Cents, CreditCard, ID, ISODate } from './types';

/** Um gasto montado a partir de texto livre, ainda não salvo. */
export interface ExpenseDraft {
  amount?: Cents;
  description: string;
  categoryId?: ID;
  paymentKey?: PaymentKey;
  date: ISODate;
  installments: number;
  /** De onde veio cada palpite (para mostrar ao usuário). */
  guessed: { category?: 'history' | 'keyword'; payment?: 'history' | 'last' };
}

export interface QuickParseContext {
  categories: Pick<Category, 'id' | 'name'>[];
  cards: Pick<CreditCard, 'id' | 'name'>[];
  index: HistoryIndex;
  today: ISODate;
  /** Forma de pagamento do último gasto (usada se nada for dito). */
  lastPaymentKey?: PaymentKey;
}

/** Palavras que não fazem parte da descrição ("10 reais no cartão de crédito"). */
const FILLER = new Set([
  'r$', 'reais', 'real', 'conto', 'contos', 'no', 'na', 'nos', 'nas', 'de', 'do', 'da', 'dos', 'das', 'em', 'com',
  'pelo', 'pela', 'cartao', 'credito', 'debito', 'gastei', 'paguei', 'comprei', 'compra', 'gasto', 'foi', 'e', 'o', 'a',
  'um', 'uma', 'via', 'pix', 'dinheiro', 'especie', 'hoje', 'ontem', 'anteontem', 'vezes', 'parcelas', 'parcelado',
  'categoria', 'valor',
]);

const MONEY_TOKEN = /^(r\$)?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^(r\$)?\d+([.,]\d{1,2})?$/;

interface Tok {
  raw: string;
  norm: string;
  used: boolean;
}

/** Separa em palavras; vírgula entre dígitos ("23,90") é decimal e não separa. */
function tokenize(text: string): Tok[] {
  const DECIMAL = '\u0000';
  return text
    .replace(/(\d),(\d)/g, `$1${DECIMAL}$2`)
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((piece) => {
      const raw = piece.split(DECIMAL).join(',');
      return { raw, norm: normalize(raw).replace(/[.!?:]+$/, ''), used: false };
    });
}

/** Procura uma sequência de palavras (ex.: "dia a dia") entre os tokens ainda não usados. */
function findPhrase(toks: Tok[], phrase: string): number {
  const words = normalize(phrase).split(' ').filter(Boolean);
  if (!words.length) return -1;
  outer: for (let i = 0; i + words.length <= toks.length; i++) {
    for (let k = 0; k < words.length; k++) {
      if (toks[i + k].used || toks[i + k].norm !== words[k]) continue outer;
    }
    return i;
  }
  return -1;
}

function consume(toks: Tok[], start: number, length: number) {
  for (let k = 0; k < length; k++) toks[start + k].used = true;
}

/**
 * Valor do gasto. Se houver vários números ("99 pop 15,90"), prefere o que tem cara de
 * dinheiro: com "R$" antes, "reais" depois ou centavos; senão, o primeiro.
 */
function parseAmount(toks: Tok[]): Cents | undefined {
  let best: { index: number; value: Cents; score: number } | undefined;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.used) continue;
    const glued = t.norm.match(/^(\d+(?:[.,]\d{1,2})?)(reais|real|r\$)$/); // "10reais"
    const candidate = glued ? glued[1] : t.norm;
    if (!MONEY_TOKEN.test(candidate)) continue;
    const next = toks[i + 1]?.norm;
    const prev = toks[i - 1]?.norm;
    if (next === 'x' || next === 'vezes' || next === 'parcelas' || prev === 'dia') continue; // parcela / data
    const value = parseMoney(candidate.replace(/^r\$/, ''));
    if (value === null || value <= 0) continue;
    const score =
      (glued || candidate.startsWith('r$') || prev === 'r$' || next === 'reais' || next === 'real' ? 2 : 0) +
      (/,\d{1,2}$/.test(candidate) ? 1 : 0);
    if (!best || score > best.score) best = { index: i, value, score };
  }
  if (!best) return undefined;
  toks[best.index].used = true;
  if (toks[best.index - 1]?.norm === 'r$') toks[best.index - 1].used = true;
  return best.value;
}

function parseInstallments(toks: Tok[]): number {
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.used) continue;
    const glued = t.norm.match(/^(\d{1,2})x$/);
    if (glued) {
      t.used = true;
      return Math.max(1, Number(glued[1]));
    }
    if (/^\d{1,2}$/.test(t.norm) && ['x', 'vezes', 'parcelas'].includes(toks[i + 1]?.norm ?? '')) {
      consume(toks, i, 2);
      if (toks[i - 1]?.norm === 'em') toks[i - 1].used = true;
      return Math.max(1, Number(t.norm));
    }
  }
  return 1;
}

function parseDate(toks: Tok[], today: ISODate): ISODate {
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.used) continue;
    if (t.norm === 'hoje') return (t.used = true), today;
    if (t.norm === 'ontem') return (t.used = true), addDays(today, -1);
    if (t.norm === 'anteontem') return (t.used = true), addDays(today, -2);
    // "15/11" ou "15/11/2026"
    const slash = t.norm.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (slash) {
      t.used = true;
      const { y } = parseISO(today);
      const year = slash[3] ? (slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3])) : y;
      return toISO(clampDay(year, Number(slash[2]), Number(slash[1])));
    }
    // "dia 15": deste mês (ou do mês passado, se ainda não chegou)
    if (t.norm === 'dia' && /^\d{1,2}$/.test(toks[i + 1]?.norm ?? '')) {
      consume(toks, i, 2);
      const day = Number(toks[i + 1].norm);
      const { y, m } = parseISO(today);
      let date = toISO(clampDay(y, m, day));
      if (date > today) date = toISO(clampDay(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1, day));
      return date;
    }
  }
  return today;
}

function parsePayment(toks: Tok[], cards: QuickParseContext['cards']): PaymentKey | undefined {
  // Nome do cartão (o mais longo primeiro: "inter black" antes de "inter").
  const byLength = [...cards].sort((a, b) => b.name.length - a.name.length);
  for (const card of byLength) {
    const at = findPhrase(toks, card.name);
    if (at >= 0) {
      consume(toks, at, normalize(card.name).split(' ').length);
      return `credit:${card.id}`;
    }
  }
  const has = (w: string) => toks.some((t) => !t.used && t.norm === w);
  if (has('pix')) return 'pix';
  if (has('debito')) return 'debit';
  if (has('dinheiro') || has('especie')) return 'cash';
  if ((has('credito') || has('cartao')) && cards.length === 1) return `credit:${cards[0].id}`;
  return undefined;
}

function parseCategory(toks: Tok[], categories: QuickParseContext['categories']): ID | undefined {
  const byLength = [...categories].sort((a, b) => b.name.length - a.name.length);
  for (const cat of byLength) {
    const at = findPhrase(toks, cat.name);
    if (at >= 0) {
      consume(toks, at, normalize(cat.name).split(' ').length);
      return cat.id;
    }
  }
  return undefined;
}

function describe(toks: Tok[]): string {
  const words = toks.filter((t) => !t.used && !FILLER.has(t.norm)).map((t) => t.raw);
  const text = words.join(' ').replace(/^[\s\-–:]+|[\s\-–:]+$/g, '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/** Interpreta uma linha ("10 reais dia a dia, tomada, cartao itau") num rascunho de gasto. */
export function parseQuickLine(text: string, ctx: QuickParseContext): ExpenseDraft | null {
  const toks = tokenize(text);
  if (!toks.length) return null;

  const installments = parseInstallments(toks);
  const date = parseDate(toks, ctx.today);
  const amount = parseAmount(toks);
  const paymentKey = parsePayment(toks, ctx.cards);
  let categoryId = parseCategory(toks, ctx.categories);
  const description = describe(toks);

  const guessed: ExpenseDraft['guessed'] = {};
  // "uber 23,90": a palavra virou categoria e a descrição ficou vazia; consulta o histórico pelo nome dela.
  const lookup = description || ctx.categories.find((c) => c.id === categoryId)?.name || '';
  const fromHistory = lookup ? suggestFromHistory(ctx.index, lookup) : undefined;
  if (!categoryId && fromHistory && ctx.categories.some((c) => c.id === fromHistory.categoryId)) {
    categoryId = fromHistory.categoryId;
    guessed.category = 'history';
  }
  if (!categoryId && description) {
    categoryId = suggestByKeywords(description, ctx.categories);
    if (categoryId) guessed.category = 'keyword';
  }

  let payment = paymentKey;
  if (!payment && fromHistory) {
    payment = fromHistory.paymentKey;
    guessed.payment = 'history';
  }
  if (!payment && ctx.lastPaymentKey) {
    payment = ctx.lastPaymentKey;
    guessed.payment = 'last';
  }

  const categoryName = ctx.categories.find((c) => c.id === categoryId)?.name;
  return {
    amount,
    description: description || categoryName || 'Gasto',
    categoryId,
    paymentKey: payment,
    date,
    installments: payment?.startsWith('credit:') ? installments : 1,
    guessed,
  };
}

/** Vários gastos de uma vez: uma linha (ou ";") por gasto. */
export function parseQuickEntry(text: string, ctx: QuickParseContext): ExpenseDraft[] {
  return text
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseQuickLine(line, ctx))
    .filter((d): d is ExpenseDraft => d !== null);
}

/** O rascunho tem tudo para ser salvo sem perguntar nada? */
export function isComplete(d: ExpenseDraft): boolean {
  return d.amount !== undefined && d.amount > 0 && !!d.categoryId && !!d.paymentKey;
}

/** Fields of a draft that travel through the `draft` route param of the expense form. */
export interface DraftParam {
  amount?: Cents;
  description?: string;
  categoryId?: ID;
  paymentKey?: PaymentKey;
  date?: ISODate;
  installments?: number;
}

/**
 * Serializes a draft so the expense form can open pre-filled.
 * @param d Draft to serialize.
 * @returns JSON string for the `draft` route param.
 */
export function draftParam(d: ExpenseDraft): string {
  const p: DraftParam = {
    amount: d.amount,
    description: d.description,
    categoryId: d.categoryId,
    paymentKey: d.paymentKey,
    date: d.date,
    installments: d.installments,
  };
  return JSON.stringify(p);
}

/**
 * Reads the `draft` route param back.
 * @param raw Route param value.
 * @returns The draft fields, or null when missing/invalid.
 */
export function readDraftParam(raw: string | undefined): DraftParam | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as DraftParam;
    return typeof p === 'object' && p !== null ? p : null;
  } catch {
    return null;
  }
}
