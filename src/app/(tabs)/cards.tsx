import { router } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HeroCard, HeroText, shade } from '@/components/hero-card';
import { Icon } from '@/components/icon';
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
  ProgressBar,
  Row,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { useSeriesColor } from '@/constants/series-colors';
import { Spacing } from '@/constants/theme';
import { allCharges } from '@/domain/charges';
import { addDays, formatShort, relativeDays, todayISO } from '@/domain/dates';
import { upcomingInvoices, type Invoice } from '@/domain/invoice';
import { formatBRL } from '@/domain/money';
import type { CreditCard } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { useFinance, useFinanceData } from '@/store/finance-store';

export default function CardsScreen() {
  const theme = useTheme();
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
    <Screen
      title="Cartões"
      subtitle="Quando pagar cada fatura"
      action={<IconButton icon="add" label="Adicionar cartão" onPress={() => router.push('/card')} />}>
      {data.cards.length === 0 ? (
        <EmptyState
          icon="card"
          text="Cadastre seus cartões de crédito com o dia de fechamento e de vencimento para acompanhar as faturas."
          action={<Button label="Adicionar cartão" icon="add" onPress={() => router.push('/card')} />}
        />
      ) : (
        <>
          <SectionHeader title="Próximos pagamentos" />
          {nextPayments.length === 0 ? (
            <EmptyState icon="check" text="Nenhuma fatura a pagar agora." />
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
          {perCard.map(({ card, invoices }) => (
            <CardBlock
              key={card.id}
              card={card}
              invoices={invoices}
              onTogglePaid={(due) => toggleInvoicePaid(card.id, due)}
            />
          ))}
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
  const series = useSeriesColor();
  const [expanded, setExpanded] = useState<string | null>(null);
  // Limite comprometido: tudo que ainda não foi pago (inclui parcelas futuras).
  const used = invoices.filter((i) => !i.paid).reduce((s, i) => s + i.total, 0);
  const open = invoices.find((i) => i.status === 'open');
  const base = series(card.color);

  return (
    <View style={styles.block}>
      <HeroCard colors={[base, shade(base, 0.45)]}>
        <Row style={styles.between}>
          <Row>
            <Icon name="card" size={22} color="#FFFFFF" />
            <HeroText type="heading">{card.name}</HeroText>
          </Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Editar ${card.name}`}
            hitSlop={10}
            onPress={() => router.push({ pathname: '/card', params: { id: card.id } })}
            style={styles.editBtn}>
            <Icon name="edit" size={16} color="#FFFFFF" />
          </Pressable>
        </Row>
        <View style={styles.cardAmount}>
          <HeroText type="caption" dim>
            FATURA ABERTA
          </HeroText>
          <HeroText type="title">{formatBRL(open?.total ?? 0)}</HeroText>
          {open ? (
            <HeroText dim>
              fecha {formatShort(open.closing)} · vence {formatShort(open.due)}
            </HeroText>
          ) : null}
        </View>
        {card.limit ? (
          <View style={styles.cardLimit}>
            <ProgressBar
              value={used}
              max={card.limit}
              color={used > card.limit ? '#FFD1D1' : '#FFFFFF'}
              trackColor="rgba(255,255,255,0.22)"
              height={6}
            />
            <Row style={styles.between}>
              <HeroText type="caption" dim>
                Limite usado {formatBRL(used)}
              </HeroText>
              <HeroText type="caption" dim>
                de {formatBRL(card.limit)}
              </HeroText>
            </Row>
          </View>
        ) : null}
        <HeroText type="caption" dim>
          Melhor dia de compra: dia {card.closingDay}
        </HeroText>
      </HeroCard>

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
                      subtitle={`${formatShort(item.date)}${item.source === 'fixed' ? ' · conta fixa' : ''}`}
                      right={formatBRL(item.amount)}
                      onPress={
                        item.expenseId
                          ? () => router.push({ pathname: '/expense', params: { id: item.expenseId! } })
                          : undefined
                      }
                    />
                  ))}
                </View>
              ) : null}
            </Fragment>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  block: { gap: Spacing.two, marginBottom: Spacing.two },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  cardAmount: { marginTop: Spacing.three, gap: 2 },
  cardLimit: { gap: Spacing.one, marginTop: Spacing.two },
  invoiceRow: { paddingVertical: Spacing.two, gap: Spacing.three },
  meta: { gap: 4, marginTop: 2 },
  checkSpace: { width: 28 },
  items: { borderRadius: 14, paddingHorizontal: Spacing.three, marginBottom: Spacing.two },
});
