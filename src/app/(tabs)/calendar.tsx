import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { MonthCalendar, type DayMarkers } from '@/components/month-calendar';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, Dot, EmptyState, Fab, KeyValue, ListItem, Row, Screen, SectionHeader } from '@/components/ui';
import { incomeDateInCycle } from '@/domain/budget';
import { allCharges } from '@/domain/charges';
import { addMonths, clampDay, daysInMonth, formatLong, MONTHS, parseISO, todayISO, toISO, type YM } from '@/domain/dates';
import { buildInvoice, invoiceDatesForDueMonth, type Invoice } from '@/domain/invoice';
import { incomeKindLabel } from '@/domain/labels';
import { formatBRL } from '@/domain/money';
import { paymentLabel } from '@/domain/payment';
import { allReceivableInstallments } from '@/domain/receivables';
import type { CreditCard, ISODate } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { useFinanceData } from '@/store/finance-store';

export default function CalendarScreen() {
  const theme = useTheme();
  const data = useFinanceData();
  const today = todayISO();
  const [month, setMonth] = useState<YM>(() => parseISO(today));
  const [selected, setSelected] = useState<ISODate>(today);

  const monthPrefix = `${month.y}-${String(month.m).padStart(2, '0')}`;
  const monthRange = useMemo(
    () => ({
      start: toISO({ y: month.y, m: month.m, d: 1 }),
      end: toISO({ y: month.y, m: month.m, d: daysInMonth(month.y, month.m) }),
      days: daysInMonth(month.y, month.m),
    }),
    [month],
  );

  const charges = useMemo(() => allCharges(data.expenses, data.cards), [data.expenses, data.cards]);
  const monthCharges = useMemo(() => charges.filter((c) => c.date.startsWith(monthPrefix)), [charges, monthPrefix]);

  const monthBills = useMemo(
    () => data.fixedBills.map((bill) => ({ bill, date: toISO(clampDay(month.y, month.m, bill.dueDay)) })),
    [data.fixedBills, month],
  );

  // incomeDateInCycle funciona com qualquer intervalo de datas; aqui, o mês do calendário.
  const monthIncomes = useMemo(
    () =>
      data.incomes
        .map((income) => ({ income, date: incomeDateInCycle(income, monthRange) }))
        .filter((x): x is { income: (typeof data.incomes)[number]; date: ISODate } => x.date !== null),
    [data, monthRange],
  );

  const monthReceivables = useMemo(
    () => allReceivableInstallments(data.receivables, today).filter((i) => i.due.startsWith(monthPrefix)),
    [data.receivables, today, monthPrefix],
  );

  // Faturas que vencem neste mês, e fechamentos que acontecem nele.
  const monthInvoices = useMemo(() => {
    const due: { card: CreditCard; invoice: Invoice }[] = [];
    const closings: { card: CreditCard; date: ISODate }[] = [];
    for (const card of data.cards) {
      due.push({
        card,
        invoice: buildInvoice(card, month, charges, data.fixedBills, today, data.invoicePaid[card.id]),
      });
      for (const k of [0, 1]) {
        const dates = invoiceDatesForDueMonth(card, addMonths(month, k));
        if (dates.closing.startsWith(monthPrefix)) closings.push({ card, date: dates.closing });
      }
    }
    return { due, closings };
  }, [data.cards, data.fixedBills, data.invoicePaid, charges, month, monthPrefix, today]);

  const markers = useMemo(() => {
    const m: DayMarkers = {};
    const add = (date: ISODate, color: string) => {
      const list = (m[date] ??= []);
      if (!list.includes(color)) list.push(color);
    };
    for (const { invoice, card } of monthInvoices.due) if (invoice.total > 0) add(invoice.due, card.color);
    for (const { date } of monthBills) add(date, theme.warning);
    for (const { date } of monthIncomes) add(date, theme.success);
    for (const r of monthReceivables) if (r.status !== 'received') add(r.due, theme.success);
    for (const c of monthCharges) {
      add(c.date, data.categories.find((cat) => cat.id === c.categoryId)?.color ?? theme.textSecondary);
    }
    return m;
  }, [monthCharges, monthBills, monthIncomes, monthReceivables, monthInvoices, data.categories, theme]);

  const dayCharges = monthCharges.filter((c) => c.date === selected);
  const dayBills = monthBills.filter((b) => b.date === selected);
  const dayIncomes = monthIncomes.filter((i) => i.date === selected);
  const dayReceivables = monthReceivables.filter((r) => r.due === selected);
  const dayInvoices = monthInvoices.due.filter((d) => d.invoice.due === selected && d.invoice.total > 0);
  const dayClosings = monthInvoices.closings.filter((c) => c.date === selected);
  const nothing =
    !dayCharges.length &&
    !dayBills.length &&
    !dayIncomes.length &&
    !dayReceivables.length &&
    !dayInvoices.length &&
    !dayClosings.length;

  const monthTotal = monthCharges.reduce((s, c) => s + c.amount, 0);
  const dayTotal = dayCharges.reduce((s, c) => s + c.amount, 0);

  return (
    <Screen
      title="Calendário"
      fab={<Fab label="Gasto" onPress={() => router.push({ pathname: '/expense', params: { date: selected } })} />}>
      <Card>
        <MonthCalendar
          month={month}
          onChangeMonth={(m) => {
            setMonth(m);
            setSelected(toISO(clampDay(m.y, m.m, parseISO(selected).d)));
          }}
          selected={selected}
          onSelect={setSelected}
          markers={markers}
        />
        <KeyValue label={`Gastos em ${MONTHS[month.m - 1].toLowerCase()}`} value={formatBRL(monthTotal)} strong />
      </Card>

      <SectionHeader
        title={formatLong(selected)}
        action={dayTotal > 0 ? <ThemedText type="smallBold">{formatBRL(dayTotal)}</ThemedText> : undefined}
      />

      {nothing ? (
        <EmptyState text={selected > today ? 'Nada agendado para este dia.' : 'Nada neste dia.'} />
      ) : (
        <Card>
          {dayInvoices.map(({ card, invoice }) => (
            <ListItem
              key={`inv-${card.id}`}
              color={card.color}
              title={`Fatura ${card.name}`}
              subtitle={`${invoice.paid ? '✓ Paga' : invoice.overdue ? '! Atrasada' : 'Vencimento'} · ${invoice.items.length} lançamento(s)`}
              right={formatBRL(invoice.total)}
              onPress={() => router.navigate('/cards')}
            />
          ))}
          {dayClosings.map(({ card }) => (
            <ListItem
              key={`close-${card.id}`}
              color={card.color}
              title={`Fatura ${card.name} fecha neste dia`}
              subtitle="Compras a partir daqui vão para a próxima fatura"
            />
          ))}
          {dayIncomes.map(({ income }) => (
            <ListItem
              key={`inc-${income.id}`}
              color={theme.success}
              title={`+ ${income.description}`}
              subtitle={`${incomeKindLabel(income.kind)} · ${income.destination === 'savings' ? 'vai para a poupança' : 'soma no livre'}`}
              right={formatBRL(income.amount)}
              onPress={() => router.push({ pathname: '/income', params: { id: income.id } })}
            />
          ))}
          {dayReceivables.map((r) => (
            <ListItem
              key={`rec-${r.receivable.id}-${r.index}`}
              color={theme.success}
              title={`${r.receivable.person} te paga`}
              subtitle={`${r.receivable.description}${r.count > 1 ? ` (${r.index + 1}/${r.count})` : ''} · ${
                r.status === 'received' ? '✓ recebido' : r.status === 'overdue' ? '! atrasado' : 'a receber'
              }`}
              right={formatBRL(r.amount)}
              onPress={() => router.navigate('/receivables')}
            />
          ))}
          {dayBills.map(({ bill }) => (
            <ListItem
              key={`bill-${bill.id}`}
              color={theme.warning}
              title={bill.name}
              subtitle={`Conta fixa · ${paymentLabel(bill.payment, data.cards)}`}
              right={formatBRL(bill.amount)}
              onPress={() => router.push({ pathname: '/fixed-bill', params: { id: bill.id } })}
            />
          ))}
          {dayCharges.map((c) => {
            const cat = data.categories.find((x) => x.id === c.categoryId);
            return (
              <ListItem
                key={c.id}
                color={cat?.color ?? theme.textSecondary}
                title={c.description}
                subtitle={`${cat?.name ?? 'Sem categoria'} · ${paymentLabel(c.payment, data.cards)}${c.index > 0 ? ' · parcela' : ''}`}
                right={formatBRL(c.amount)}
                onPress={() => router.push({ pathname: '/expense', params: { id: c.expenseId } })}
              />
            );
          })}
        </Card>
      )}

      <Row style={styles.legend}>
        <Legend color={theme.warning} label="Conta fixa" />
        <Legend color={theme.success} label="Entradas e devedores" />
        <Row>
          <Badge tone="neutral" label="Gastos na cor da categoria" />
        </Row>
      </Row>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row>
      <Dot color={color} size={8} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Row>
  );
}

const styles = StyleSheet.create({
  legend: { flexWrap: 'wrap', gap: 16 },
});
