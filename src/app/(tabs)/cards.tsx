import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Card,
  Dot,
  EmptyState,
  KeyValue,
  ListItem,
  ProgressBar,
  Row,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { addDays, formatShort, relativeDays, todayISO } from '@/domain/dates';
import { upcomingInvoices, type Invoice } from '@/domain/invoice';
import { formatBRL } from '@/domain/money';
import type { CreditCard } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { useFinanceData } from '@/store/finance-store';

export default function CardsScreen() {
  const data = useFinanceData();
  const today = todayISO();

  const perCard = useMemo(
    () =>
      data.cards.map((card) => ({
        card,
        invoices: upcomingInvoices(card, data.expenses, data.fixedBills, today),
      })),
    [data.cards, data.expenses, data.fixedBills, today],
  );

  // Próximos pagamentos de todos os cartões, em ordem de vencimento.
  const nextPayments = useMemo(
    () =>
      perCard
        .flatMap(({ card, invoices }) =>
          invoices.filter((i) => i.status !== 'future' && i.total > 0).map((invoice) => ({ card, invoice })),
        )
        .sort((a, b) => a.invoice.due.localeCompare(b.invoice.due)),
    [perCard],
  );

  return (
    <Screen title="Cartões" subtitle="Quando pagar cada fatura">
      {data.cards.length === 0 ? (
        <EmptyState
          text="Cadastre seus cartões de crédito com o dia de fechamento e de vencimento para acompanhar as faturas."
          action={<Button label="Adicionar cartão" onPress={() => router.push('/card')} />}
        />
      ) : (
        <>
          {nextPayments.length > 0 ? (
            <>
              <SectionHeader title="Próximos pagamentos" />
              <Card>
                {nextPayments.map(({ card, invoice }) => (
                  <ListItem
                    key={`${card.id}-${invoice.due}`}
                    color={card.color}
                    title={`${card.name} · vence ${formatShort(invoice.due)}`}
                    subtitle={
                      invoice.status === 'closed'
                        ? `Fechada · pagar ${relativeDays(invoice.due, today)}`
                        : `Aberta · fecha ${formatShort(invoice.closing)}, ainda pode aumentar`
                    }
                    right={formatBRL(invoice.total)}
                  />
                ))}
              </Card>
            </>
          ) : null}

          {perCard.map(({ card, invoices }) => (
            <CardBlock key={card.id} card={card} invoices={invoices} />
          ))}

          <Button label="Adicionar cartão" variant="secondary" onPress={() => router.push('/card')} />
        </>
      )}
    </Screen>
  );
}

const STATUS_LABEL: Record<Invoice['status'], string> = {
  closed: 'Fechada',
  open: 'Aberta',
  future: 'Próxima',
  past: 'Paga',
};

function CardBlock({ card, invoices }: { card: CreditCard; invoices: Invoice[] }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);
  const used = invoices.reduce((s, i) => s + i.total, 0);

  return (
    <Card>
      <Row style={styles.between}>
        <Row>
          <Dot color={card.color} size={14} />
          <ThemedText type="smallBold">{card.name}</ThemedText>
        </Row>
        <Button
          label="Editar"
          variant="ghost"
          compact
          onPress={() => router.push({ pathname: '/card', params: { id: card.id } })}
        />
      </Row>
      <ThemedText type="small" themeColor="textSecondary">
        Fecha dia {card.closingDay} · vence dia {card.dueDay}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.success }}>
        Melhor dia de compra: dia {card.closingDay} (cai na fatura seguinte, mais prazo para pagar)
      </ThemedText>

      {card.limit ? (
        <View style={styles.limit}>
          <ProgressBar value={used} max={card.limit} color={used > card.limit ? theme.danger : card.color} />
          <KeyValue label="Limite comprometido" value={`${formatBRL(used)} de ${formatBRL(card.limit)}`} />
        </View>
      ) : null}

      {invoices.map((inv) => {
        const isOpen = expanded === inv.due;
        return (
          <View key={inv.due} style={[styles.invoice, { borderTopColor: theme.border }]}>
            <Pressable onPress={() => setExpanded(isOpen ? null : inv.due)}>
              <Row style={styles.between}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">
                    {STATUS_LABEL[inv.status]} · vence {formatShort(inv.due)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {inv.status === 'closed'
                      ? `Fechou ${formatShort(inv.closing)} · pagar ${relativeDays(inv.due)}`
                      : `Compras até ${formatShort(addDays(inv.closing, -1))} · fecha ${formatShort(inv.closing)}`}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">
                  {formatBRL(inv.total)} {inv.items.length > 0 ? (isOpen ? '▲' : '▼') : ''}
                </ThemedText>
              </Row>
            </Pressable>
            {isOpen
              ? inv.items.map((item) => (
                  <ListItem
                    key={item.id}
                    title={item.description}
                    subtitle={`${formatShort(item.date)}${item.source === 'fixed' ? ' · conta fixa' : ''}`}
                    right={formatBRL(item.amount)}
                    onPress={
                      item.source === 'expense'
                        ? () => router.push({ pathname: '/expense', params: { id: item.id } })
                        : undefined
                    }
                  />
                ))
              : null}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  limit: { gap: Spacing.one, marginTop: Spacing.one },
  invoice: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, marginTop: Spacing.one },
});
