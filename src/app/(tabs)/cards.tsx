import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Badge,
  Button,
  Card,
  Checkbox,
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
import { allCharges } from '@/domain/charges';
import { addDays, formatShort, relativeDays, todayISO } from '@/domain/dates';
import { upcomingInvoices, type Invoice } from '@/domain/invoice';
import { formatBRL } from '@/domain/money';
import type { CreditCard } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { useFinance, useFinanceData } from '@/store/finance-store';

export default function CardsScreen() {
  const data = useFinanceData();
  const toggleInvoicePaid = useFinance((s) => s.toggleInvoicePaid);
  const today = todayISO();

  const perCard = useMemo(() => {
    const charges = allCharges(data.expenses, data.cards);
    return data.cards.map((card) => ({
      card,
      invoices: upcomingInvoices(card, charges, data.fixedBills, today, data.invoicePaid[card.id]),
    }));
  }, [data.cards, data.expenses, data.fixedBills, data.invoicePaid, today]);

  // Próximos pagamentos de todos os cartões (atrasadas primeiro), em ordem de vencimento.
  const nextPayments = useMemo(
    () =>
      perCard
        .flatMap(({ card, invoices }) =>
          invoices
            .filter((i) => !i.paid && i.total > 0 && i.status !== 'future')
            .map((invoice) => ({ card, invoice })),
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
          <SectionHeader title="Próximos pagamentos" />
          {nextPayments.length === 0 ? (
            <EmptyState text="Nenhuma fatura a pagar agora. ✓" />
          ) : (
            <Card>
              {nextPayments.map(({ card, invoice }) => (
                <ListItem
                  key={`${card.id}-${invoice.due}`}
                  color={card.color}
                  title={`${card.name} · vence ${formatShort(invoice.due)}`}
                  subtitle={
                    invoice.overdue
                      ? `! Atrasada · venceu ${relativeDays(invoice.due, today)}`
                      : invoice.status === 'closed'
                        ? `Fechada · pagar ${relativeDays(invoice.due, today)}`
                        : `Aberta · fecha ${formatShort(invoice.closing)}, ainda pode aumentar`
                  }
                  right={
                    <Row>
                      <ThemedText type="smallBold">{formatBRL(invoice.total)}</ThemedText>
                      <Checkbox
                        checked={false}
                        label={`Marcar fatura ${card.name} como paga`}
                        onPress={() => toggleInvoicePaid(card.id, invoice.due)}
                      />
                    </Row>
                  }
                />
              ))}
            </Card>
          )}

          {perCard.map(({ card, invoices }) => (
            <CardBlock
              key={card.id}
              card={card}
              invoices={invoices}
              onTogglePaid={(due) => toggleInvoicePaid(card.id, due)}
            />
          ))}

          <Button label="Adicionar cartão" variant="secondary" onPress={() => router.push('/card')} />
        </>
      )}
    </Screen>
  );
}

function statusBadge(inv: Invoice) {
  if (inv.paid) return <Badge tone="success" label="Paga" />;
  if (inv.overdue) return <Badge tone="danger" label="Atrasada" />;
  if (inv.status === 'closed') return <Badge tone="warning" label="Fechada · a pagar" />;
  if (inv.status === 'open') return <Badge tone="neutral" label="Aberta" />;
  return <Badge tone="neutral" label="Próxima" />;
}

function CardBlock({
  card,
  invoices,
  onTogglePaid,
}: {
  card: CreditCard;
  invoices: Invoice[];
  onTogglePaid: (due: string) => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);
  // Limite comprometido: tudo que ainda não foi pago (inclui parcelas futuras).
  const used = invoices.filter((i) => !i.paid).reduce((s, i) => s + i.total, 0);

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
        Fecha dia {card.closingDay} · vence dia {card.dueDay} · melhor dia de compra: {card.closingDay}
      </ThemedText>

      {card.limit ? (
        <View style={styles.limit}>
          <ProgressBar value={used} max={card.limit} color={used > card.limit ? theme.danger : card.color} />
          <KeyValue label="Limite comprometido" value={`${formatBRL(used)} de ${formatBRL(card.limit)}`} />
        </View>
      ) : null}

      {invoices.map((inv) => {
        const isOpen = expanded === inv.due;
        const canPay = inv.total > 0 && inv.status !== 'future';
        return (
          <View key={inv.due} style={[styles.invoice, { borderTopColor: theme.border }]}>
            <Row style={styles.between}>
              <Pressable style={styles.flex} onPress={() => setExpanded(isOpen ? null : inv.due)}>
                <Row>
                  <ThemedText type="smallBold">Vence {formatShort(inv.due)}</ThemedText>
                  {statusBadge(inv)}
                </Row>
                <ThemedText type="small" themeColor="textSecondary">
                  {inv.status === 'closed' || inv.status === 'past'
                    ? `Fechou ${formatShort(inv.closing)}`
                    : `Compras até ${formatShort(addDays(inv.closing, -1))} · fecha ${formatShort(inv.closing)}`}
                  {inv.items.length > 0 ? ` · ${inv.items.length} item(s) ${isOpen ? '▲' : '▼'}` : ''}
                </ThemedText>
              </Pressable>
              <ThemedText type="smallBold">{formatBRL(inv.total)}</ThemedText>
              {canPay ? (
                <Checkbox
                  checked={inv.paid}
                  label={`Fatura de ${formatShort(inv.due)} paga`}
                  onPress={() => onTogglePaid(inv.due)}
                />
              ) : null}
            </Row>
            {isOpen
              ? inv.items.map((item) => (
                  <ListItem
                    key={item.id}
                    title={item.description}
                    subtitle={`${formatShort(item.date)}${item.source === 'fixed' ? ' · conta fixa' : ''}`}
                    right={formatBRL(item.amount)}
                    onPress={
                      item.expenseId
                        ? () => router.push({ pathname: '/expense', params: { id: item.expenseId! } })
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
  invoice: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, marginTop: Spacing.one, gap: Spacing.one },
});
