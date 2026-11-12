import { router } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CreditCardVisual } from '@/components/credit-card-visual';
import { Icon } from '@/components/icon';
import { Appear } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  EmptyState,
  IconButton,
  ListItem,
  Row,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { invoiceCharges } from '@/domain/invoice-charges';
import { addDays, formatShort, relativeDays, todayISO } from '@/domain/dates';
import { upcomingInvoices, type Invoice } from '@/domain/invoice';
import { useMoney } from '@/store/ui-store';
import type { CreditCard } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { useFinance, useFinanceData } from '@/store/finance-store';
import { haptic } from '@/ui/haptics';

/** Space between cards in the carousel. */
const CARD_GAP = 12;

/** Cards tab: next payments, a swipeable wallet of cards and the bills of the selected one. */
export default function CardsScreen() {
  const theme = useTheme();
  const { money: formatBRL } = useMoney();
  const data = useFinanceData();
  const toggleInvoicePaid = useFinance((s) => s.toggleInvoicePaid);
  const today = todayISO();

  const perCard = useMemo(() => {
    const charges = invoiceCharges(data, today);
    return data.cards.map((card) => ({
      card,
      invoices: upcomingInvoices(card, charges, data.fixedBills, today, data.invoicePaid[card.id]),
    }));
  }, [data, today]);

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

  const [index, setIndex] = useState(0);
  const selected = perCard[Math.min(index, perCard.length - 1)];
  const { width } = useWindowDimensions();
  const available = Math.min(width, MaxContentWidth) - Spacing.three * 2;
  // With several cards the next one peeks in from the right, inviting the swipe.
  const cardWidth = Math.min(420, perCard.length > 1 ? available * 0.88 : available);

  return (
    <Screen
      title="Cartões"
      subtitle="Quando pagar cada fatura"
      action={
        <Row>
          <IconButton icon="download" label="Importar fatura" onPress={() => router.push('/import')} />
          <IconButton icon="add" label="Adicionar cartão" onPress={() => router.push('/card')} />
        </Row>
      }>
      {data.cards.length === 0 ? (
        <EmptyState
          icon="card"
          title="Sua carteira está vazia"
          text="Cadastre seus cartões com o dia de fechamento e de vencimento para saber quando pagar cada fatura."
          action={<Button label="Adicionar cartão" icon="add" onPress={() => router.push('/card')} />}
        />
      ) : (
        <>
          <SectionHeader title="Próximos pagamentos" />
          {nextPayments.length === 0 ? (
            <EmptyState icon="check" title="Tudo em dia" text="Nenhuma fatura para pagar agora. Aproveite! 🎉" />
          ) : (
            <Card>
              {nextPayments.map(({ card, invoice }, i) => (
                <Fragment key={`${card.id}-${invoice.due}`}>
                  {i > 0 ? <Divider /> : null}
                  <ListItem
                    icon="card"
                    color={card.color}
                    title={`${card.name} · ${formatShort(invoice.due)}`}
                    subtitle={
                      invoice.overdue
                        ? `! Atrasada · venceu ${relativeDays(invoice.due, today)}`
                        : invoice.status === 'closed'
                          ? `Fechada · pagar ${relativeDays(invoice.due, today)}`
                          : `Aberta · fecha ${formatShort(invoice.closing)}`
                    }
                    subtitleColor={invoice.overdue ? theme.danger : invoice.status === 'closed' ? theme.warning : undefined}
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
                </Fragment>
              ))}
            </Card>
          )}

          <SectionHeader title="Meus cartões" />
          {/* Swipe between cards like a wallet; the bills of the selected one follow below. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + CARD_GAP}
            decelerationRate="fast"
            disableIntervalMomentum
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
            onMomentumScrollEnd={(e) => {
              const next = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP));
              if (next !== index) haptic.selection();
              setIndex(Math.max(0, Math.min(perCard.length - 1, next)));
            }}>
            {perCard.map(({ card, invoices }) => (
              <CreditCardVisual
                key={card.id}
                card={card}
                open={invoices.find((i) => i.status === 'open')}
                used={invoices.filter((i) => !i.paid).reduce((s, i) => s + i.total, 0)}
                width={cardWidth}
                onEdit={() => router.push({ pathname: '/card', params: { id: card.id } })}
              />
            ))}
          </ScrollView>
          {perCard.length > 1 ? (
            <View style={styles.dots} accessible accessibilityLabel={`Cartão ${index + 1} de ${perCard.length}`}>
              {perCard.map(({ card }, i) => (
                <View
                  key={card.id}
                  style={[styles.dot, { backgroundColor: i === index ? theme.accent : theme.border }, i === index && styles.dotActive]}
                />
              ))}
            </View>
          ) : null}
          {selected ? (
            <InvoiceList
              key={selected.card.id}
              card={selected.card}
              invoices={selected.invoices}
              onTogglePaid={(due) => toggleInvoicePaid(selected.card.id, due)}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function statusBadge(inv: Invoice) {
  if (inv.paid) return <Badge tone="success" label="Paga" />;
  if (inv.overdue) return <Badge tone="danger" label="Atrasada" />;
  if (inv.status === 'closed') return <Badge tone="warning" label="Fechada" />;
  if (inv.status === 'open') return <Badge tone="accent" label="Aberta" />;
  return <Badge tone="neutral" label="Próxima" />;
}

/** Bills of one card (open, closed, next), each expandable into its purchases. */
function InvoiceList({
  card,
  invoices,
  onTogglePaid,
}: {
  card: CreditCard;
  invoices: Invoice[];
  onTogglePaid: (due: string) => void;
}) {
  const theme = useTheme();
  const { money: formatBRL } = useMoney();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Appear style={styles.block}>
      <ThemedText type="caption" themeColor="textSecondary">
        Melhor dia de compra no {card.name}: dia {card.closingDay}
      </ThemedText>
      <Card>
        {invoices.map((inv, i) => {
          const isOpen = expanded === inv.due;
          const canPay = inv.total > 0 && inv.status !== 'future';
          return (
            <Fragment key={inv.due}>
              {i > 0 ? <Divider /> : null}
              <Row style={styles.invoiceRow}>
                <Pressable
                  style={styles.flex}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  onPress={() => setExpanded(isOpen ? null : inv.due)}>
                  <Row>
                    <ThemedText type="smallBold">Vence {formatShort(inv.due)}</ThemedText>
                    {statusBadge(inv)}
                  </Row>
                  <Row style={styles.meta}>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {inv.status === 'closed' || inv.status === 'past'
                        ? `Fechou ${formatShort(inv.closing)}`
                        : `Compras até ${formatShort(addDays(inv.closing, -1))}`}
                      {inv.items.length > 0 ? ` · ${inv.items.length} item(s)` : ''}
                    </ThemedText>
                    {inv.items.length > 0 ? (
                      <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} size={14} color={theme.textSecondary} />
                    ) : null}
                  </Row>
                </Pressable>
                <ThemedText type="smallBold">{formatBRL(inv.total)}</ThemedText>
                {canPay ? (
                  <Checkbox
                    checked={inv.paid}
                    label={`Fatura de ${formatShort(inv.due)} paga`}
                    onPress={() => onTogglePaid(inv.due)}
                  />
                ) : (
                  <View style={styles.checkSpace} />
                )}
              </Row>
              {isOpen ? (
                <View style={[styles.items, { backgroundColor: theme.backgroundSelected }]}>
                  {inv.items.map((item) => (
                    <ListItem
                      key={item.id}
                      title={item.description}
                      subtitle={`${formatShort(item.date)}${item.source === 'fixed' ? ' · conta fixa' : item.source === 'agreement' ? ' · acordo (fora das categorias)' : ''}`}
                      right={formatBRL(item.amount)}
                      onPress={
                        !item.expenseId
                          ? undefined
                          : item.source === 'agreement'
                            ? () => router.push({ pathname: '/agreement', params: { id: item.expenseId! } })
                            : () => router.push({ pathname: '/expense', params: { id: item.expenseId! } })
                      }
                    />
                  ))}
                </View>
              ) : null}
            </Fragment>
          );
        })}
      </Card>
    </Appear>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  block: { gap: Spacing.two, marginBottom: Spacing.two },
  // Bleeds to the screen edges so cards slide in from outside the content padding.
  carousel: { marginHorizontal: -Spacing.three },
  carouselContent: { paddingHorizontal: Spacing.three, gap: CARD_GAP },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 18 },
  invoiceRow: { paddingVertical: Spacing.two, gap: Spacing.three },
  meta: { gap: 4, marginTop: 2 },
  checkSpace: { width: 28 },
  items: { borderRadius: 14, paddingHorizontal: Spacing.three, marginBottom: Spacing.two },
});
