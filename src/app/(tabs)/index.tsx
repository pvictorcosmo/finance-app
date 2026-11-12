import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { Fragment, useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoryIcon, Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  AppRefreshControl,
  Button,
  Card,
  Checkbox,
  Divider,
  EmptyState,
  Fab,
  ListItem,
  ProgressBar,
  Row,
  SectionHeader,
  StatTile,
} from '@/components/ui';
import { FEATURES } from '@/constants/features';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { computeBudget, type CategoryStatus } from '@/domain/budget';
import { dueDateInCycle } from '@/domain/cycle';
import { formatShort, relativeDays } from '@/domain/dates';
import { cycleHistory, savingsTotal } from '@/domain/history';
import { upcomingInvoices } from '@/domain/invoice';
import { invoiceCharges } from '@/domain/invoice-charges';
import { paymentLabel } from '@/domain/payment';
import { useCycleNavigator } from '@/hooks/use-cycle';
import { useTheme } from '@/hooks/use-theme';
import { useFinance, useFinanceData } from '@/store/finance-store';
import { useMoney, useUiStore } from '@/store/ui-store';
import { useSyncStore } from '@/sync/sync-store';

interface Shortcut {
  icon: IconName;
  label: string;
  onPress: () => void;
}

/** "pvictorcosmo@gmail.com" -> "Pvictorcosmo" (greeting when signed in). */
function nameFromEmail(email: string | null): string | null {
  const local = email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : null;
}

/**
 * Home: purple header with the money left this cycle (can be hidden), round
 * shortcuts, card bills, category pace, savings, fixed bills and recent purchases.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const data = useFinanceData();
  const toggleFixedPaid = useFinance((s) => s.toggleFixedPaid);
  const { money, hidden } = useMoney();
  const toggleHideValues = useUiStore((s) => s.toggleHideValues);
  const email = useSyncStore((s) => s.email);
  const { cycle, offset, setOffset, today, isCurrent } = useCycleNavigator();

  // White status bar text over the purple header while this tab is focused.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );

  const budget = useMemo(() => computeBudget(data, cycle, today), [data, cycle, today]);
  const savings = useMemo(() => savingsTotal(cycleHistory(data, today)), [data, today]);
  const recent = useMemo(
    // Only what already happened; future installments live in the statement/calendar.
    () =>
      budget.charges
        .filter((c) => c.date <= today)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    [budget.charges, today],
  );
  const bills = useMemo(
    () =>
      data.fixedBills
        .map((bill) => ({ bill, due: dueDateInCycle(cycle, bill.dueDay) }))
        .sort((a, b) => a.due.localeCompare(b.due)),
    [data.fixedBills, cycle],
  );
  const cardBills = useMemo(() => {
    const charges = invoiceCharges(data, today);
    return data.cards
      .map((card) => ({
        card,
        invoice: upcomingInvoices(card, charges, data.fixedBills, today, data.invoicePaid[card.id]).find(
          (i) => !i.paid && i.status !== 'future',
        ),
      }))
      .filter((x) => x.invoice);
  }, [data, today]);
  const paid = data.fixedPaid[cycle.start] ?? [];

  const shortcuts: Shortcut[] = [
    { icon: 'add', label: 'Lançar gasto', onPress: () => router.push('/expense') },
    { icon: 'sparkles', label: 'Assistente', onPress: () => router.push('/assistant') },
    { icon: 'search', label: 'Buscar', onPress: () => router.navigate('/extrato') },
    { icon: 'download', label: 'Importar', onPress: () => router.push('/import') },
    { icon: 'calendar', label: 'Calendário', onPress: () => router.push('/calendar') },
    { icon: 'chart', label: 'Histórico', onPress: () => router.push('/history') },
    ...(FEATURES.receivables
      ? [{ icon: 'person' as IconName, label: 'Devedores', onPress: () => router.push('/receivables') }]
      : []),
  ];

  const name = nameFromEmail(email);
  const over = budget.leftover < 0;
  const cycleLabel = `${formatShort(cycle.start)} – ${formatShort(cycle.end)}`;
  const heroText = { color: '#FFFFFF' };
  const heroMuted = { color: theme.onHeroMuted };

  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        refreshControl={<AppRefreshControl />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={[styles.hero, { backgroundColor: theme.heroSurface, paddingTop: insets.top + Spacing.three }]}>
          <View style={styles.inner}>
            <Row style={styles.between}>
              <View style={styles.avatar}>
                <ThemedText type="smallBold" style={heroText}>
                  {(name ?? 'F').charAt(0)}
                </ThemedText>
              </View>
              <Row>
                <HeaderButton
                  icon={hidden ? 'eyeOff' : 'eye'}
                  label={hidden ? 'Mostrar valores' : 'Ocultar valores'}
                  onPress={toggleHideValues}
                />
                <HeaderButton icon="settings" label="Planejar e ajustes" onPress={() => router.navigate('/plan')} />
              </Row>
            </Row>
            <ThemedText type="heading" style={[heroText, styles.greeting]}>
              {name ? `Olá, ${name}` : 'Olá!'}
            </ThemedText>

            {data.settings.salary > 0 ? (
              <>
                <Row style={styles.cycleRow}>
                  <HeaderButton icon="chevronLeft" label="Ciclo anterior" small onPress={() => setOffset(offset - 1)} />
                  <Pressable onPress={() => setOffset(0)} accessibilityRole="button" accessibilityLabel="Voltar ao ciclo atual">
                    <ThemedText type="caption" style={heroMuted}>
                      {isCurrent ? `Ciclo ${cycleLabel}` : `${offset < 0 ? 'Encerrado' : 'Futuro'} · ${cycleLabel}`}
                    </ThemedText>
                  </Pressable>
                  <HeaderButton icon="chevronRight" label="Próximo ciclo" small onPress={() => setOffset(offset + 1)} />
                </Row>
                <ThemedText type="caption" style={heroMuted}>
                  {over ? 'Passou do livre em' : isCurrent ? 'Disponível no mês' : 'Sobrou no ciclo'}
                </ThemedText>
                <ThemedText type="title" style={heroText} accessibilityLabel={hidden ? 'Valor oculto' : undefined}>
                  {money(Math.abs(budget.leftover))}
                </ThemedText>
                <ThemedText type="small" style={heroMuted}>
                  de {money(budget.free)} livres
                  {isCurrent ? ` · faltam ${budget.daysLeft} ${budget.daysLeft === 1 ? 'dia' : 'dias'}` : ''}
                </ThemedText>
                <View style={styles.heroBar}>
                  <ProgressBar
                    value={budget.spent}
                    max={budget.free}
                    color={over ? '#FFD1D1' : '#FFFFFF'}
                    trackColor="rgba(255,255,255,0.22)"
                    marker={isCurrent ? budget.progress : undefined}
                  />
                </View>
              </>
            ) : (
              <ThemedText type="small" style={heroMuted}>
                Comece informando seu salário em Planejar.
              </ThemedText>
            )}
          </View>
        </View>

        <View style={styles.inner}>
          {/* Shortcuts */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
            {shortcuts.map((s) => (
              <Pressable
                key={s.label}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                onPress={s.onPress}
                style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
                <View style={[styles.shortcutCircle, { backgroundColor: theme.backgroundSelected }]}>
                  <Icon name={s.icon} size={24} color={theme.text} />
                </View>
                <ThemedText type="caption" style={styles.center} numberOfLines={2}>
                  {s.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.sections}>
            {data.settings.salary === 0 ? (
              <EmptyState
                icon="savings"
                text="Comece informando seu salário, suas contas fixas e quanto quer gastar em cada categoria."
                action={<Button label="Configurar meu mês" icon="chevronRight" onPress={() => router.navigate('/plan')} />}
              />
            ) : null}

            {/* Card bills */}
            {cardBills.length ? (
              <Card>
                {cardBills.map(({ card, invoice }, i) => (
                  <Fragment key={card.id}>
                    {i > 0 ? <Divider /> : null}
                    <ListItem
                      icon="card"
                      color={card.color}
                      title={`Fatura ${card.name}`}
                      subtitle={
                        invoice!.overdue
                          ? `! Atrasada · venceu ${formatShort(invoice!.due)}`
                          : invoice!.status === 'closed'
                            ? `Fechada · vence ${formatShort(invoice!.due)} (${relativeDays(invoice!.due, today)})`
                            : `Aberta · fecha ${formatShort(invoice!.closing)}`
                      }
                      subtitleColor={invoice!.overdue ? theme.danger : undefined}
                      right={money(invoice!.total)}
                      onPress={() => router.navigate('/cards')}
                    />
                  </Fragment>
                ))}
              </Card>
            ) : null}

            {/* Categories */}
            {budget.categories.length ? (
              <>
                <SectionHeader
                  title="Categorias"
                  action={<Button label="Histórico" icon="chart" variant="ghost" compact onPress={() => router.push('/history')} />}
                />
                <Card>
                  {budget.categories.map((status, i) => (
                    <Fragment key={status.category.id}>
                      {i > 0 ? <Divider /> : null}
                      <CategoryRow status={status} showPace={isCurrent} />
                    </Fragment>
                  ))}
                  {budget.uncategorized > 0 ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      {money(budget.uncategorized)} em gastos sem categoria.
                    </ThemedText>
                  ) : null}
                </Card>
              </>
            ) : null}

            {/* Savings */}
            <Row style={styles.tiles}>
              <StatTile
                icon="savings"
                label="Poupança"
                value={money(savings)}
                tone={savings < 0 ? 'danger' : 'accent'}
                hint={
                  isCurrent && budget.leftover > 0
                    ? `+ até ${money(budget.leftover + budget.directSavings)} neste ciclo`
                    : 'Ver histórico'
                }
                onPress={() => router.push('/history')}
              />
            </Row>

            {/* Fixed bills */}
            {bills.length > 0 ? (
              <>
                <SectionHeader title="Contas fixas" />
                <Card>
                  {bills.map(({ bill, due }, i) => {
                    const onCard = bill.payment.kind === 'credit';
                    const isPaid = paid.includes(bill.id);
                    const overdue = !isPaid && !onCard && due < today;
                    return (
                      <Fragment key={bill.id}>
                        {i > 0 ? <Divider /> : null}
                        <ListItem
                          icon="bill"
                          color={isPaid ? theme.success : overdue ? theme.danger : theme.warning}
                          title={bill.name}
                          subtitle={
                            onCard
                              ? `${formatShort(due)} · na fatura do ${paymentLabel(bill.payment, data.cards)}`
                              : `${isPaid ? '✓ Paga' : overdue ? '! Venceu' : 'Vence'} ${formatShort(due)}${
                                  isPaid ? '' : ` · ${relativeDays(due, today)}`
                                }`
                          }
                          right={
                            <Row>
                              <ThemedText type="smallBold" style={overdue ? { color: theme.danger } : undefined}>
                                {money(bill.amount)}
                              </ThemedText>
                              {!onCard ? (
                                <Checkbox
                                  checked={isPaid}
                                  label={`Marcar ${bill.name} como paga`}
                                  onPress={() => toggleFixedPaid(cycle.start, bill.id)}
                                />
                              ) : null}
                            </Row>
                          }
                        />
                      </Fragment>
                    );
                  })}
                </Card>
              </>
            ) : null}

            {/* Recent purchases */}
            <SectionHeader
              title="Últimas compras"
              action={
                <Button label="Ver extrato" icon="list" variant="ghost" compact onPress={() => router.navigate('/extrato')} />
              }
            />
            {recent.length === 0 ? (
              <EmptyState icon="cart" text="Nenhuma compra neste ciclo ainda. Toque em Lançar gasto para começar." />
            ) : (
              <Card>
                {recent.map((c, i) => {
                  const cat = data.categories.find((x) => x.id === c.categoryId);
                  return (
                    <Fragment key={c.id}>
                      {i > 0 ? <Divider /> : null}
                      <ListItem
                        icon={cat ? categoryIcon(cat) : 'tag'}
                        color={cat?.color ?? theme.textSecondary}
                        title={c.description}
                        subtitle={`${formatShort(c.date)} · ${paymentLabel(c.payment, data.cards)}`}
                        right={money(c.amount)}
                        onPress={() => router.push({ pathname: '/expense', params: { id: c.expenseId } })}
                      />
                    </Fragment>
                  );
                })}
              </Card>
            )}
          </View>
        </View>
      </ScrollView>
      <Fab label="Gasto" onPress={() => router.push('/expense')} />
    </ThemedView>
  );
}

/** Round translucent button on the purple header. */
function HeaderButton({
  icon,
  label,
  onPress,
  small,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  small?: boolean;
}) {
  const size = small ? 28 : 40;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerButton,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={small ? 16 : 20} color="#FFFFFF" />
    </Pressable>
  );
}

/** One category with spending, limit, pace marker and a status line. */
function CategoryRow({ status, showPace }: { status: CategoryStatus; showPace: boolean }) {
  const theme = useTheme();
  const { money } = useMoney();
  const { category, spent, limit, expected, remaining, perDayLeft, health } = status;

  let message: string;
  let color: string = theme.textSecondary;
  if (health === 'unset') {
    message = 'Sem limite definido';
  } else if (health === 'over') {
    message = `! Estourou ${money(-remaining)}`;
    color = theme.danger;
  } else if (health === 'attention' && showPace) {
    message = `! Acima do ritmo · normal seria ${money(expected)}`;
    color = theme.warning;
  } else if (showPace) {
    message = `✓ No ritmo · ${money(perDayLeft)}/dia`;
    color = theme.success;
  } else {
    message = `Sobrou ${money(remaining)}`;
  }

  return (
    <View style={styles.catRow}>
      <ListItem
        icon={categoryIcon(category)}
        color={category.color}
        title={category.name}
        subtitle={message}
        subtitleColor={color}
        right={
          <View style={styles.catRight}>
            <ThemedText type="smallBold">{money(spent)}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              de {money(limit)}
            </ThemedText>
          </View>
        }
        onPress={() => router.navigate({ pathname: '/extrato' })}
      />
      <View style={styles.catBar}>
        <ProgressBar
          value={spent}
          max={limit}
          color={health === 'over' ? theme.danger : category.color}
          marker={showPace && limit > 0 ? expected / limit : undefined}
          height={6}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.three },
  hero: { paddingBottom: Spacing.four, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, gap: Spacing.one },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  greeting: { marginTop: Spacing.three, marginBottom: Spacing.two },
  cycleRow: { gap: Spacing.one, marginBottom: Spacing.one },
  heroBar: { marginTop: Spacing.three },
  headerButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  shortcuts: { gap: Spacing.three, paddingVertical: Spacing.three },
  shortcut: { width: 72, alignItems: 'center', gap: 6 },
  shortcutCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  sections: { gap: Spacing.three },
  tiles: { alignItems: 'stretch', gap: Spacing.three },
  catRow: { paddingBottom: Spacing.two },
  catRight: { alignItems: 'flex-end' },
  catBar: { marginLeft: 56 },
});
