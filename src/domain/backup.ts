import { DATA_VERSION, migrateData } from './migrate';
import type { FinanceData } from './types';

/** Marca que identifica um arquivo de backup deste app. */
const FORMAT = 'finance-app-backup';

interface BackupFile {
  format: typeof FORMAT;
  /** Versão do formato dos dados (para migrar backups antigos ao importar). */
  version: number;
  exportedAt: string;
  data: FinanceData;
}

export interface BackupSummary {
  exportedAt: string;
  expenses: number;
  cards: number;
  categories: number;
  people: number;
}

export type ParseResult =
  | { ok: true; data: FinanceData; summary: BackupSummary }
  | { ok: false; error: string };

export function backupFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `finance-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/** Gera o conteúdo do arquivo de backup (JSON legível). */
export function serializeBackup(data: FinanceData, exportedAt: string = new Date().toISOString()): string {
  const file: BackupFile = { format: FORMAT, version: DATA_VERSION, exportedAt, data };
  return JSON.stringify(file, null, 2);
}

function summarize(data: FinanceData, exportedAt: string): BackupSummary {
  const people = new Set(
    [...data.receivables, ...data.agreements].map((x) => x.person.trim().toLocaleLowerCase('pt-BR')),
  );
  return {
    exportedAt,
    expenses: data.expenses.length,
    cards: data.cards.length,
    categories: data.categories.length,
    people: people.size,
  };
}

const isArray = (x: unknown) => Array.isArray(x);

/** Lê e valida um arquivo de backup; backups de versões antigas são atualizados. */
export function parseBackup(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'O arquivo não é um backup válido (não foi possível ler o conteúdo).' };
  }
  const file = parsed as Partial<BackupFile>;
  if (!file || file.format !== FORMAT || typeof file.version !== 'number' || !file.data) {
    return { ok: false, error: 'Este arquivo não é um backup do Finance.' };
  }
  if (file.version > DATA_VERSION) {
    return { ok: false, error: 'Este backup foi feito numa versão mais nova do app. Atualize o app e tente de novo.' };
  }
  const d = file.data as Partial<FinanceData>;
  if (!d.settings || !isArray(d.categories) || !isArray(d.expenses) || !isArray(d.cards) || !isArray(d.fixedBills)) {
    return { ok: false, error: 'O backup está incompleto ou corrompido.' };
  }
  const data = migrateData(d, file.version);
  return { ok: true, data, summary: summarize(data, file.exportedAt ?? '') };
}
