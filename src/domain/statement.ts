import { toISO } from './dates';
import { normalize } from './text';
import type { Cents, ISODate } from './types';

/**
 * Leitura de extratos e faturas exportados pelos bancos (OFX e CSV).
 * Testado com os formatos de Nubank, Itaú, Inter e Banco do Brasil; para outros,
 * as colunas são detectadas pelo cabeçalho ou pelo conteúdo.
 */

export interface StatementRow {
  date: ISODate;
  description: string;
  /** Valor com o sinal do arquivo (centavos). */
  amount: Cents;
  /** Identificador do banco (OFX FITID), quando existe. */
  externalId?: string;
}

export interface ParsedStatement {
  format: 'ofx' | 'csv';
  /** Pista do tipo de arquivo: fatura de cartão ou extrato de conta. */
  kind: 'card' | 'account' | 'unknown';
  rows: StatementRow[];
  /** Nome do banco, quando dá para reconhecer. */
  bank?: string;
}

/** Linhas que não são gastos (saldo, pagamento da fatura, estornos internos...). */
const SKIP = /\b(saldo|s a l d o|pagamento (de |da )?fatura|pagamento recebido|pagto fatura|total|limite|juros de|iof de|credito de rotativo|resgate|aplicacao)\b/;

// ---------------------------------------------------------------- valores e datas

/**
 * "−1.234,56", "-1234.56", "1.234,56 D", "R$ 10,00", "10,00-" -> centavos com sinal.
 */
export function parseSignedAmount(raw: string): Cents | null {
  let s = raw.trim().replace(/r\$/i, '').replace(/\s+/g, '').replace(/[−–]/g, '-');
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/[dD]$/.test(s)) {
    negative = true;
    s = s.slice(0, -1);
  } else if (/[cC]$/.test(s)) {
    s = s.slice(0, -1);
  }
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;

  // Decimal = o último separador seguido de 1–2 dígitos no fim.
  const m = s.match(/^(.*)[.,](\d{1,2})$/);
  const normalized = m ? `${m[1].replace(/[.,]/g, '')}.${m[2]}` : s.replace(/[.,]/g, '');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

/** "01/11/2026", "2026-11-01", "01/11/26", "20261101" -> ISO. */
export function parseDateCell(raw: string): ISODate | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const month = Number(m[2]);
    const day = Number(m[1]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return toISO({ y: year, m: month, d: day });
  }
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// ---------------------------------------------------------------- OFX

function ofxField(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
  return m?.[1].trim();
}

function parseOfx(text: string): ParsedStatement {
  const rows: StatementRow[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0];
    const date = parseDateCell(ofxField(block, 'DTPOSTED') ?? '');
    const amount = parseSignedAmount((ofxField(block, 'TRNAMT') ?? '').replace(',', '.'));
    const memo = ofxField(block, 'MEMO');
    const name = ofxField(block, 'NAME');
    const description = (memo && name && !memo.includes(name) ? `${name} ${memo}` : memo || name || '').trim();
    if (!date || amount === null || !description) continue;
    rows.push({ date, amount, description, externalId: ofxField(block, 'FITID') });
  }
  const bankId = ofxField(text, 'BANKID') ?? ofxField(text, 'ORG') ?? '';
  const bank = /341|itau/i.test(bankId)
    ? 'Itaú'
    : /260|nu ?pagamentos|nubank/i.test(bankId)
      ? 'Nubank'
      : /077|inter/i.test(bankId)
        ? 'Inter'
        : /^0*1$|banco do brasil/i.test(bankId)
          ? 'Banco do Brasil'
          : undefined;
  return { format: 'ofx', kind: /CREDITCARDMSGSRS|CCSTMTRS/i.test(text) ? 'card' : 'account', rows, bank };
}

// ---------------------------------------------------------------- CSV

/** Divide uma linha CSV respeitando aspas. */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function detectSeparator(lines: string[]): string {
  const sample = lines.slice(0, 20);
  const score = (sep: string) => sample.reduce((s, l) => s + (splitCsvLine(l, sep).length - 1), 0);
  return [';', ',', '\t'].sort((a, b) => score(b) - score(a))[0];
}

const HEADER = {
  date: /^(data|date|dt|data lancamento|data do lancamento|data da compra|data mov|data movimento)\b/,
  description: /(descri|historico|title|titulo|lancamento|estabelecimento|memo|detalhe|identificacao)/,
  amount: /^(valor|amount|value|quantia|valor \(r\$\)|valor r\$|valor em r\$)/,
  type: /^(tipo lancamento|tipo|natureza|d\/c|entrada\/saida)$/,
};

interface Columns {
  date: number;
  description: number;
  amount: number;
  /** Coluna "Entrada/Saída" ou "D/C" (BB), quando existe. */
  type?: number;
  /** Coluna extra para juntar à descrição (BB: "Detalhes"). */
  extra?: number;
}

function findHeader(rows: string[][]): { headerIndex: number; cols: Columns } | null {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cells = rows[i].map((c) => normalize(c));
    const date = cells.findIndex((c) => HEADER.date.test(c));
    const amount = cells.findIndex((c) => HEADER.amount.test(c));
    if (date < 0 || amount < 0) continue;
    // Descrição: prefere "descrição"/"histórico"; "lançamento" só se não houver outra.
    let description = cells.findIndex((c, k) => k !== date && /(descri|title|titulo|estabelecimento|memo)/.test(c));
    if (description < 0) description = cells.findIndex((c, k) => k !== date && HEADER.description.test(c));
    if (description < 0) continue;
    const type = cells.findIndex((c) => HEADER.type.test(c));
    const extra = cells.findIndex((c, k) => k !== description && /^detalhes?$/.test(c));
    return {
      headerIndex: i,
      cols: { date, description, amount, type: type >= 0 ? type : undefined, extra: extra >= 0 ? extra : undefined },
    };
  }
  return null;
}

/** Sem cabeçalho reconhecível: descobre as colunas pelo conteúdo. */
function guessColumns(rows: string[][]): Columns | null {
  const sample = rows.slice(0, 30).filter((r) => r.length >= 3);
  if (!sample.length) return null;
  const width = Math.max(...sample.map((r) => r.length));
  const ratio = (test: (s: string) => boolean, col: number) =>
    sample.filter((r) => r[col] !== undefined && test(r[col])).length / sample.length;
  let date = -1;
  let amount = -1;
  let description = -1;
  let bestText = 0;
  for (let c = 0; c < width; c++) {
    if (date < 0 && ratio((s) => parseDateCell(s) !== null, c) > 0.6) date = c;
    else if (amount < 0 && ratio((s) => parseSignedAmount(s) !== null && /\d/.test(s), c) > 0.6) amount = c;
  }
  for (let c = 0; c < width; c++) {
    if (c === date || c === amount) continue;
    const avg = sample.reduce((s, r) => s + (r[c]?.replace(/[\d\s.,/-]/g, '').length ?? 0), 0) / sample.length;
    if (avg > bestText) {
      bestText = avg;
      description = c;
    }
  }
  return date >= 0 && amount >= 0 && description >= 0 ? { date, amount, description } : null;
}

function parseCsv(text: string): ParsedStatement {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const sep = detectSeparator(lines);
  const table = lines.map((l) => splitCsvLine(l, sep));
  const header = findHeader(table);
  const cols = header?.cols ?? guessColumns(table);
  if (!cols) return { format: 'csv', kind: 'unknown', rows: [] };

  const headerCells = header ? table[header.headerIndex].map(normalize) : [];
  const rows: StatementRow[] = [];
  for (const cells of table.slice(header ? header.headerIndex + 1 : 0)) {
    const date = parseDateCell(cells[cols.date] ?? '');
    let amount = parseSignedAmount(cells[cols.amount] ?? '');
    let description = (cells[cols.description] ?? '').trim();
    if (cols.extra !== undefined && cells[cols.extra]) description = `${description} ${cells[cols.extra]}`.trim();
    if (!date || amount === null || !description) continue;
    // BB: coluna "Tipo Lançamento" com Entrada/Saída (ou D/C) define o sinal.
    if (cols.type !== undefined) {
      const t = normalize(cells[cols.type] ?? '');
      if (/^(saida|debito|d)$/.test(t)) amount = -Math.abs(amount);
      else if (/^(entrada|credito|c)$/.test(t)) amount = Math.abs(amount);
    }
    rows.push({ date, amount, description });
  }

  // Nubank fatura: "date,title,amount" (compras positivas). Nubank conta: "Data,Valor,Identificador,Descrição".
  const joined = headerCells.join('|');
  const nubankCard = joined === 'date|title|amount';
  const nubankAccount = /^data\|valor\|identificador\|descricao/.test(joined);
  const bank = nubankCard || nubankAccount ? 'Nubank' : undefined;
  return { format: 'csv', kind: nubankCard ? 'card' : nubankAccount ? 'account' : 'unknown', rows, bank };
}

// ---------------------------------------------------------------- entrada

export function parseStatement(text: string): ParsedStatement {
  return /<OFX>|OFXHEADER/i.test(text) ? parseOfx(text) : parseCsv(text);
}

export interface ImportCandidate extends StatementRow {
  /** Valor positivo do gasto. */
  value: Cents;
}

/**
 * Separa os gastos das entradas. Em extratos e faturas, os gastos são a maioria dos
 * lançamentos, então o sinal mais comum é o de "gasto" (negativo na conta, positivo
 * na fatura do Nubank). Linhas de saldo, pagamento de fatura etc. são descartadas.
 */
export function splitExpenses(rows: StatementRow[]): { expenses: ImportCandidate[]; ignored: StatementRow[] } {
  const usable = rows.filter((r) => r.amount !== 0 && !SKIP.test(normalize(r.description)));
  const negatives = usable.filter((r) => r.amount < 0).length;
  const expenseSign = negatives >= usable.length - negatives ? -1 : 1;
  const expenses: ImportCandidate[] = [];
  const ignored: StatementRow[] = rows.filter((r) => !usable.includes(r));
  for (const r of usable) {
    if (Math.sign(r.amount) === expenseSign) expenses.push({ ...r, value: Math.abs(r.amount) });
    else ignored.push(r);
  }
  return { expenses, ignored };
}
