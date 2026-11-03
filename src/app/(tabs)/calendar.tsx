import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { MonthCalendar, type DayMarkers } from '@/components/month-calendar';
import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, Fab, KeyValue, ListItem, Row, Screen, SectionHeader } from '@/components/ui';
import { addMonths, clampDay, formatLong, MONTHS, parseISO, todayISO, toISO, type YM } from '@/domain/dates';
import { buildInvoice, invoiceDatesForDueMonth, type Invoice } from '@/domain/invoice';
import { formatBRL } from '@/domain/money';
import { paymentLabel } from '@/domain/payment';
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

  const monthExpenses = useMemo(
    () => data.expenses.filter((e) => e.date.startsWith(monthPrefix)),
    [data.expenses, monthPrefix],
  );

  // Contas fixas que vencem neste mês.
  const monthBills = useMemo(
    () => data.fixedBills.map((bill) => ({ bill, date: toISO(clampDay(month.y, month.m, bill.dueDay)) })),
    [data.fixedBills, month],
  );

  // Faturas de cartão que vencem neste mês, e fechamentos que acontecem nele.
  const monthInvoices = useMemo(() => {
    const due: { card: CreditCard; invoice: Invoice }[] = [];
    const closings: { card: CreditCard; date: ISODate }[] = [];
    for (const card of data.cards) {
      due.push({ card, invoice: buildInvoice(card, month, data.expenses, data.fixedBills, today) });
      // A fatura que fecha neste mês vence neste mês ou no próximo.
      for (const k of [0, 1]) {
        const inv = invoiceDatesForDueMonth(card, addMonths(month, k));
        if (inv.closing.startsWith(monthPrefix)) closings.push({ card, date: inv.closing });
      }
    }
    return { due, closings };
  }, [data.cards, data.expenses, data.fixedBills, month, monthPrefix, today]);

  const markers = useMemo(() => {
    const m: DayMarkers = {};
    const add = (date: ISODate, color: string) => {
      const list = (m[date] ??= []);
      if (!list.includes(color)) list.push(color);
    };
    for (const { invoice, card } of monthInvoices.due) if (invoice.total > 0) add(invoice.due, card.color);
    for (const { date } of monthBills) add(date, theme.warning);
    for (const e of monthExpenses) {
      add(e.date, data.categories.find((c) => c.id === e.categoryId)?.color ?? theme.textSecondary);
    }
    return m;
  }, [monthExpenses, monthBills, monthInvoices, data.categories, theme]);

  const dayExpenses = monthExpenses.filter((e) => e.date === selected);
  const dayBills = monthBills.filter((b) => b.date === selected);
  const dayInvoices = monthInvoices.due.filter((d) => d.invoice.due === selected && d.invoice.total > 0);
  const dayClosings = monthInvoices.closings.filter((c) => c.date === selected);
  const nothing = !dayExpenses.length && !dayBills.length && !dayInvoices.length && !dayClosings.length;

  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <Screen
      title="Calendário"
      fab={<Fab label="Gasto" onPress={() => router.push({ pathname: '/expense', params: { date: selected } })} />}>
      <Card>
        <MonthCalendar
          month={month}
          onChangeMonth={setMonth}
          selected={selected}
          onSelect={setSelected}
          markers={markers}
        />
        <KeyValue label={`Gastos em ${MONTHS[month.m - 1].toLowerCase()}`} value={formatBRL(monthTotal)} strong />
      </Card>

      <SectionHeader title={formatLong(selected)} action={dayTotal > 0 ? <ThemedText type="smallBold">{formatBRL(dayTotal)}</ThemedText> : undefined} />

      {nothing ? (
        <EmptyState text={selected > today ? 'Nada agendado para este dia.' : 'Nenhum gasto neste dia.'} />
      ) : (
        <Card>
          {dayInvoices.map(({ card, invoice }) => (
            <ListItem
              key={`inv-${card.id}`}
              color={card.color}
              title={`Fatura ${card.name}`}
              subtitle={`Vencimento · ${invoice.items.length} lançamento(s)`}
              right={formatBRL(invoice.total)}
              onPress={() => router.navigate('/cards')}
            />
          ))}
          {dayClosings.map(({ card }) => (
            <ListItem
              key={`close-${card.id}`}
              color={card.color}
              title={`Fatura ${card.name} fecha hoje`}
              subtitle="Compras a partir de hoje vão para a próxima fatura"
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
          {dayExpenses.map((e) => {
            const cat = data.categories.find((c) => c.id === e.categoryId);
            return (
              <ListItem
                key={e.id}
                color={cat?.color ?? theme.textSecondary}
                title={e.description}
                subtitle={`${cat?.name ?? 'Sem categoria'} · ${paymentLabel(e.payment, data.cards)}`}
                right={formatBRL(e.amount)}
                onPress={() => router.push({ pathname: '/expense', params: { id: e.id } })}
              />
            );
          })}
        </Card>
      )}

      <Row style={styles.legend}>
        <Legend color={theme.warning} label="Conta fixa" />
        <Legend color={theme.primary} label="Gastos (cor da categoria)" />
      </Row>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row>
      <ThemedText style={{ color }}>●</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Row>
  );
}

const styles = StyleSheet.create({
  legend: { flexWrap: 'wrap', gap: 16 },
});
