import { agreementOccurrences } from './agreements';
import { computeBudget, type CategoryStatus } from './budget';
import { allCharges } from './charges';
import { cycleFor } from './cycle';
import { addDays, addMonths, clampDay, parseISO, toISO } from './dates';
import { invoiceCharges } from './invoice-charges';
import { buildInvoice } from './invoice';
import { formatBRLShort } from './money';
import { allReceivableInstallments } from './receivables';
import type { FinanceData, ISODate } from './types';

export interface DailySummary {
  title: string;
  body: string;
}

/** Ordem de gravidade: estourou > acima do ritmo > sem limite > no ritmo. */
const SEVERITY: Record<CategoryStatus['health'], number> = { over: 0, attention: 1, unset: 3, ok: 2 };

function categoryLine(c: CategoryStatus): string {
  const spent = `${formatBRLShort(c.spent)}/${formatBRLShort(c.limit)}`;
  switch (c.health) {
    case 'over':
      return `🔴 ${c.category.name}: ${spent} · estourou ${formatBRLShort(-c.remaining)}`;
    case 'attention':
      return `🟡 ${c.category.name}: ${spent} · acima do ritmo`;
    case 'unset':
      return `⚪ ${c.category.name}: ${formatBRLShort(c.spent)} · sem limite`;
    default:
      return `🟢 ${c.category.name}: ${spent} · ${formatBRLShort(c.perDayLeft)}/dia`;
  }
}

/** O que vence no dia: contas fixas, faturas e pagamentos de devedores/acordos. */
function dueToday(data: FinanceData, date: ISODate): string[] {
  const { y, m } = parseISO(date);
  const lines: string[] = [];

  for (const bill of data.fixedBills) {
    if (bill.payment.kind === 'credit') continue; // já entra na fatura
    if (toISO(clampDay(y, m, bill.dueDay)) === date) lines.push(`${bill.name} ${formatBRLShort(bill.amount)}`);
  }

  if (data.cards.length) {
    const charges = invoiceCharges(data, date);
    for (const card of data.cards) {
      for (const k of [0, 1]) {
        const inv = buildInvoice(card, addMonths({ y, m }, k), charges, data.fixedBills, date, data.invoicePaid[card.id]);
        if (inv.due === date && inv.total > 0 && !inv.paid) lines.push(`fatura ${card.name} ${formatBRLShort(inv.total)}`);
      }
    }
  }
  return lines;
}

function toReceiveToday(data: FinanceData, date: ISODate): string[] {
  const lines: string[] = [];
  for (const inst of allReceivableInstallments(data.receivables, date)) {
    if (inst.due === date && inst.status !== 'received') {
      lines.push(`${inst.receivable.person} ${formatBRLShort(inst.amount)}`);
    }
  }
  for (const a of data.agreements) {
    for (const o of agreementOccurrences(a, date, date)) {
      if (o.date !== date || o.status === 'settled' || o.status === 'compensated') continue;
      lines.push(o.net > 0 ? `${a.person} ${formatBRLShort(o.net)}` : `você → ${a.person} ${formatBRLShort(-o.net)}`);
    }
  }
  return lines;
}

/**
 * Texto da notificação diária para o dia `date`, com os dados atuais.
 * (Para dias futuros, assume que nada novo foi gasto até lá; o app reagenda quando você lança algo.)
 */
export function buildDailySummary(data: FinanceData, date: ISODate): DailySummary {
  const cycle = cycleFor(date, data.settings.cycleStartDay);
  const budget = computeBudget(data, cycle, date, allCharges(data.expenses, data.cards));
  const days = budget.daysLeft;
  const daysText = `${days} ${days === 1 ? 'dia' : 'dias'}`;

  const title =
    budget.leftover >= 0
      ? `💰 ${formatBRLShort(budget.leftover)} livres no mês · faltam ${daysText}`
      : `⚠️ Passou ${formatBRLShort(-budget.leftover)} do livre · faltam ${daysText}`;

  const lines = [...budget.categories]
    .sort((a, b) => SEVERITY[a.health] - SEVERITY[b.health])
    .map(categoryLine);

  const due = dueToday(data, date);
  if (due.length) lines.push(`📅 Vence hoje: ${due.join(', ')}`);
  const receive = toReceiveToday(data, date);
  if (receive.length) lines.push(`🤝 Acertos hoje: ${receive.join(', ')}`);

  // Amanhã também ajuda a se programar (só contas e faturas).
  const tomorrow = dueToday(data, addDays(date, 1));
  if (tomorrow.length) lines.push(`⏰ Amanhã: ${tomorrow.join(', ')}`);

  return { title, body: lines.join('\n') || 'Cadastre categorias para acompanhar seu mês.' };
}
