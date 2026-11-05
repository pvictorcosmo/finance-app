import { router } from 'expo-router';
import { Fragment, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { HeroCard, HeroText } from '@/components/hero-card';
import { categoryIcon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Card,
  Checkbox,
  Divider,
  EmptyState,
  Fab,
  IconButton,
  ListItem,
  ProgressBar,
  Row,
  Screen,
  SectionHeader,
  StatTile,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { computeBudget, type CategoryStatus } from '@/domain/budget';
import { dueDateInCycle, isInCycle } from '@/domain/cycle';
import { formatShort, relativeDays } from '@/domain/dates';
import { cycleHistory, savingsTotal } from '@/domain/history';
import { formatBRL } from '@/domain/money';
import { paymentLabel } from '@/domain/payment';
import { allAgreementOccurrences, isOpen } from '@/domain/agreements';
import { allReceivableInstallments } from '@/domain/receivables';
import { useCycleNavigator } from '@/hooks/use-cycle';
import { useTheme } from '@/hooks/use-theme';
import { useFinance, useFinanceData } from '@/store/finance-store';

export default function SummaryScreen() {
  const theme = useTheme();
  const data = useFinanceData();
  const toggleFixedPaid = useFinance((s) => s.toggleFixedPaid);
  const { cycle, offset, setOffset, today, isCurrent } = useCycleNavigator();

  const budget = useMemo(() => computeBudget(data, cycle, today), [data, cycle, today]);
  const savings = useMemo(() => savingsTotal(cycleHistory(data, today)), [data, today]);
  const recent = useMemo(
    // Só o que já aconteceu: parcelas e gastos agendados para o futuro ficam no calendário.
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
  const toReceive = useMemo(() => {
    // Empréstimos + meses de acordo em que a pessoa te deve (saldo positivo).
    const pending = [
      ...allReceivableInstallments(data.receivables, today)
        .filter((i) => i.status !== 'received')
        .map((i) => ({ date: i.due, amount: i.amount, overdue: i.status === 'overdue' })),
      ...allAgreementOccurrences(data.agreements, cycle.end, today)
        .filter((o) => isOpen(o) && o.net > 0)
        .map((o) => ({ date: o.date, amount: o.net, overdue: o.status === 'overdue' })),
    ];
    return {
      inCycle: pending.filter((p) => isInCycle(p.date, cycle)).reduce((s, p) => s + p.amount, 0),
      overdue: pending.filter((p) => p.overdue).reduce((s, p) => s + p.amount, 0),
    };
  }, [data.receivables, data.agreements, today, cycle]);
  const paid = data.fixedPaid[cycle.start] ?? [];

  if (data.settings.salary === 0) {
    return (
      <Screen title="Resumo" subtitle="Vamos montar seu mês">
        <EmptyState
          icon="savings"
          text="Comece informando seu salário, suas contas fixas e quanto quer gastar em cada categoria."
          action={<Button label="Configurar meu mês" icon="chevronRight" onPress={() => router.navigate('/plan')} />}
        />
      </Screen>
    );
  }

  const over = budget.leftover < 0;
  const cycleLabel = `${formatShort(cycle.start)} – ${formatShort(cycle.end)}`;

  return (
    <Screen
      title="Resumo"
      subtitle={isCurrent ? `Ciclo ${cycleLabel}` : `${offset < 0 ? 'Ciclo encerrado' : 'Ciclo futuro'} · ${cycleLabel}`}
      action={
        <Row>
          <IconButton icon="sparkles" label="Assistente: lançar gasto por texto" onPress={() => router.push('/assistant')} />
          <IconButton icon="chevronLeft" label="Ciclo anterior" onPress={() => setOffset(offset - 1)} />
          <IconButton icon="chevronRight" label="Próximo ciclo" onPress={() => setOffset(offset + 1)} />
        </Row>
      }
      fab={<Fab label="Gasto" onPress={() => router.push('/expense')} />}>
      {!isCurrent ? (
        <Button label="Voltar para o ciclo atual" variant="secondary" compact onPress={() => setOffset(0)} />
      ) : null}

      <HeroCard>
        <HeroText type="caption" dim>
          {over ? 'PASSOU DO LIVRE EM' : isCurrent ? 'DISPONÍVEL NO CICLO' : 'SOBROU NO CICLO'}
        </HeroText>
        <HeroText type="title">{formatBRL(Math.abs(budget.leftover))}</HeroText>
        <HeroText dim>
          de {formatBRL(budget.free)} livres
          {isCurrent ? ` · faltam ${budget.daysLeft} ${budget.daysLeft === 1 ? 'dia' : 'dias'}` : ''}
        </HeroText>
        <View style={styles.heroBar}>
          <ProgressBar
            value={budget.spent}
            max={budget.free}
            color={over ? '#FFD1D1' : '#FFFFFF'}
            trackColor="rgba(255,255,255,0.22)"
            marker={isCurrent ? budget.progress : undefined}
          />
        </View>
        <Row style={styles.heroStats}>
          <HeroStat label="Renda" value={formatBRL(budget.salary + budget.extraIncome)} />
          <HeroStat label="Fixas" value={formatBRL(budget.fixed)} />
          <HeroStat label="Gasto" value={formatBRL(budget.spent)} />
        </Row>
      </HeroCard>

      {budget.unallocated < 0 ? (
        <ThemedText type="caption" style={{ color: theme.warning }}>
          ! Os limites das categorias somam {formatBRL(-budget.unallocated)} a mais do que o livre.
        </ThemedText>
      ) : null}

      <Row style={styles.tiles}>
        <StatTile
          icon="savings"
          label="Poupança"
          value={formatBRL(savings)}
          tone={savings < 0 ? 'danger' : 'accent'}
          hint={
            isCurrent && budget.leftover > 0
              ? `+ até ${formatBRL(budget.leftover + budget.directSavings)} neste ciclo`
              : 'Ver histórico'
          }
          onPress={() => router.push('/history')}
        />
        <StatTile
          icon="person"
          label="A receber"
          value={formatBRL(toReceive.inCycle)}
          tone={toReceive.overdue > 0 ? 'danger' : 'success'}
          hint={toReceive.overdue > 0 ? `! ${formatBRL(toReceive.overdue)} atrasado` : 'neste ciclo'}
          onPress={() => router.navigate('/receivables')}
        />
      </Row>

      <SectionHeader
        title="Categorias"
        action={<Button label="Gráficos" icon="chart" variant="ghost" compact onPress={() => router.push('/history')} />}
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
            {formatBRL(budget.uncategorized)} em gastos sem categoria.
          </ThemedText>
        ) : null}
      </Card>

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
                          {formatBRL(bill.amount)}
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

      <SectionHeader
        title="Últimos gastos"
        action={
          <Button label="Calendário" icon="calendar" variant="ghost" compact onPress={() => router.navigate('/calendar')} />
        }
      />
      {recent.length === 0 ? (
        <EmptyState icon="cart" text="Nenhum gasto neste ciclo ainda. Toque em + Gasto para lançar o primeiro." />
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
                  right={
                    <Row>
                      <ThemedText type="smallBold">{formatBRL(c.amount)}</ThemedText>
                      <IconButton
                        icon="repeat"
                        label={`Repetir ${c.description}`}
                        onPress={() => router.push({ pathname: '/expense', params: { repeat: c.expenseId } })}
                      />
                    </Row>
                  }
                  onPress={() => router.push({ pathname: '/expense', params: { id: c.expenseId } })}
                />
              </Fragment>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <HeroText type="caption" dim>
        {label}
      </HeroText>
      <HeroText type="smallBold">{value}</HeroText>
    </View>
  );
}

function CategoryRow({ status, showPace }: { status: CategoryStatus; showPace: boolean }) {
  const theme = useTheme();
  const { category, spent, limit, expected, remaining, perDayLeft, health } = status;

  let message: string;
  let color: string = theme.textSecondary;
  if (health === 'unset') {
    message = 'Sem limite definido';
  } else if (health === 'over') {
    message = `! Estourou ${formatBRL(-remaining)}`;
    color = theme.danger;
  } else if (health === 'attention' && showPace) {
    message = `! Acima do ritmo · normal seria ${formatBRL(expected)}`;
    color = theme.warning;
  } else if (showPace) {
    message = `✓ No ritmo · ${formatBRL(perDayLeft)}/dia`;
    color = theme.success;
  } else {
    message = `Sobrou ${formatBRL(remaining)}`;
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
            <ThemedText type="smallBold">{formatBRL(spent)}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              de {formatBRL(limit)}
            </ThemedText>
          </View>
        }
        onPress={() => router.push({ pathname: '/category', params: { id: category.id } })}
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
  heroBar: { marginTop: Spacing.two },
  heroStats: { marginTop: Spacing.two, justifyContent: 'space-between' },
  heroStat: { gap: 2 },
  tiles: { alignItems: 'stretch', gap: Spacing.three },
  catRow: { paddingBottom: Spacing.two },
  catRight: { alignItems: 'flex-end' },
  catBar: { marginLeft: 56 },
});
