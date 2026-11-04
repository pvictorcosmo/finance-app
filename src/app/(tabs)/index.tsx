import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Card,
  Checkbox,
  Dot,
  EmptyState,
  Fab,
  KeyValue,
  ListItem,
  ProgressBar,
  Row,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { computeBudget, type CategoryStatus } from '@/domain/budget';
import { dueDateInCycle, elapsedDays, isInCycle } from '@/domain/cycle';
import { formatShort, relativeDays } from '@/domain/dates';
import { cycleHistory, savingsTotal } from '@/domain/history';
import { formatBRL } from '@/domain/money';
import { paymentLabel } from '@/domain/payment';
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
    () => [...budget.charges].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [budget.charges],
  );
  const bills = useMemo(
    () =>
      data.fixedBills
        .map((bill) => ({ bill, due: dueDateInCycle(cycle, bill.dueDay) }))
        .sort((a, b) => a.due.localeCompare(b.due)),
    [data.fixedBills, cycle],
  );
  const toReceive = useMemo(() => {
    const pending = allReceivableInstallments(data.receivables, today).filter((i) => i.status !== 'received');
    const inCycle = pending.filter((i) => isInCycle(i.due, cycle));
    const overdue = pending.filter((i) => i.status === 'overdue');
    return {
      inCycle: inCycle.reduce((s, i) => s + i.amount, 0),
      overdue: overdue.reduce((s, i) => s + i.amount, 0),
      overdueCount: overdue.length,
    };
  }, [data.receivables, today, cycle]);
  const paid = data.fixedPaid[cycle.start] ?? [];

  if (data.settings.salary === 0) {
    return (
      <Screen title="Resumo">
        <EmptyState
          text="Comece informando seu salário, suas contas fixas e quanto quer gastar em cada categoria."
          action={<Button label="Configurar meu mês" onPress={() => router.navigate('/plan')} />}
        />
      </Screen>
    );
  }

  const cycleInfo = isCurrent
    ? `Dia ${elapsedDays(cycle, today)} de ${cycle.days} · faltam ${budget.daysLeft} dias`
    : offset < 0
      ? 'Ciclo encerrado'
      : 'Ciclo futuro';

  return (
    <Screen title="Resumo" fab={<Fab label="Gasto" onPress={() => router.push('/expense')} />}>
      <Card>
        <Row style={styles.between}>
          <Pressable hitSlop={12} onPress={() => setOffset(offset - 1)} accessibilityLabel="Ciclo anterior">
            <ThemedText type="subtitle">‹</ThemedText>
          </Pressable>
          <View style={styles.centerCol}>
            <ThemedText type="smallBold">
              {formatShort(cycle.start)} – {formatShort(cycle.end)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {cycleInfo}
            </ThemedText>
          </View>
          <Pressable hitSlop={12} onPress={() => setOffset(offset + 1)} accessibilityLabel="Próximo ciclo">
            <ThemedText type="subtitle">›</ThemedText>
          </Pressable>
        </Row>
        {!isCurrent ? (
          <Button label="Voltar para o ciclo atual" variant="ghost" compact onPress={() => setOffset(0)} />
        ) : null}
      </Card>

      <Card>
        <KeyValue label="Salário" value={formatBRL(budget.salary)} />
        {budget.extraIncome > 0 ? <KeyValue label="Renda extra" value={`+ ${formatBRL(budget.extraIncome)}`} /> : null}
        <KeyValue label="Contas fixas" value={`− ${formatBRL(budget.fixed)}`} />
        <KeyValue label="Livre para as categorias" value={formatBRL(budget.free)} strong />
        <View style={styles.gapTop}>
          <ProgressBar
            value={budget.spent}
            max={budget.free}
            color={budget.spent > budget.free ? theme.danger : theme.primary}
            marker={isCurrent ? budget.progress : undefined}
          />
        </View>
        <KeyValue label="Gasto no ciclo" value={formatBRL(budget.spent)} />
        <KeyValue
          label={budget.leftover >= 0 ? 'Ainda disponível' : 'Passou do livre'}
          value={formatBRL(Math.abs(budget.leftover))}
          strong
          color={budget.leftover >= 0 ? theme.success : theme.danger}
        />
        {budget.unallocated < 0 ? (
          <ThemedText type="small" style={{ color: theme.warning }}>
            ! Os limites das categorias somam {formatBRL(-budget.unallocated)} a mais do que o livre.
          </ThemedText>
        ) : budget.unallocated > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {formatBRL(budget.unallocated)} do livre não está em nenhuma categoria e tende a virar poupança.
          </ThemedText>
        ) : null}
      </Card>

      <Pressable onPress={() => router.push('/history')} style={({ pressed }) => pressed && styles.pressed}>
        <Card>
          <Row style={styles.between}>
            <ThemedText type="smallBold">Poupança</ThemedText>
            <ThemedText type="smallBold" style={{ color: savings >= 0 ? theme.text : theme.danger }}>
              {formatBRL(savings)}
            </ThemedText>
          </Row>
          <ThemedText type="small" themeColor="textSecondary">
            {isCurrent && budget.leftover > 0
              ? `Se o ritmo continuar, este ciclo soma até ${formatBRL(budget.leftover + budget.directSavings)}.`
              : 'O que sobra em cada ciclo entra aqui quando ele fecha.'}
            {budget.directSavings > 0 ? ` ${formatBRL(budget.directSavings)} já foram direto para a poupança.` : ''}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.primary }}>
            Ver histórico e gráficos ›
          </ThemedText>
        </Card>
      </Pressable>

      {toReceive.inCycle > 0 || toReceive.overdue > 0 ? (
        <Pressable onPress={() => router.navigate('/receivables')} style={({ pressed }) => pressed && styles.pressed}>
          <Card>
            <KeyValue label="A receber neste ciclo" value={formatBRL(toReceive.inCycle)} strong />
            {toReceive.overdue > 0 ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                ! {toReceive.overdueCount} pagamento(s) atrasado(s): {formatBRL(toReceive.overdue)}
              </ThemedText>
            ) : null}
          </Card>
        </Pressable>
      ) : null}

      <SectionHeader title="Categorias" />
      {budget.categories.map((status) => (
        <CategoryCard key={status.category.id} status={status} showPace={isCurrent} />
      ))}
      {budget.uncategorized > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {formatBRL(budget.uncategorized)} em gastos sem categoria.
        </ThemedText>
      ) : null}

      {bills.length > 0 ? (
        <>
          <SectionHeader title="Contas fixas do ciclo" />
          <Card>
            {bills.map(({ bill, due }) => {
              const onCard = bill.payment.kind === 'credit';
              const isPaid = paid.includes(bill.id);
              const overdue = !isPaid && !onCard && due < today;
              return (
                <ListItem
                  key={bill.id}
                  title={bill.name}
                  subtitle={
                    onCard
                      ? `${formatShort(due)} · na fatura do ${paymentLabel(bill.payment, data.cards)}`
                      : `${isPaid ? '✓ Paga' : overdue ? '! Venceu' : 'Vence'} ${formatShort(due)}${
                          isPaid ? '' : ` (${relativeDays(due, today)})`
                        } · ${paymentLabel(bill.payment, data.cards)}`
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
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionHeader
        title="Últimos gastos"
        action={<Button label="Ver calendário" variant="ghost" compact onPress={() => router.navigate('/calendar')} />}
      />
      {recent.length === 0 ? (
        <EmptyState text="Nenhum gasto neste ciclo ainda." />
      ) : (
        <Card>
          {recent.map((c) => {
            const cat = data.categories.find((x) => x.id === c.categoryId);
            return (
              <ListItem
                key={c.id}
                color={cat?.color ?? theme.textSecondary}
                title={c.description}
                subtitle={`${formatShort(c.date)} · ${cat?.name ?? 'Sem categoria'} · ${paymentLabel(c.payment, data.cards)}`}
                right={formatBRL(c.amount)}
                onPress={() => router.push({ pathname: '/expense', params: { id: c.expenseId } })}
              />
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

function CategoryCard({ status, showPace }: { status: CategoryStatus; showPace: boolean }) {
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
    message = `! Acima do ritmo: o normal até hoje seria ${formatBRL(expected)}`;
    color = theme.warning;
  } else if (showPace) {
    message = `✓ Dentro do ritmo · pode gastar ${formatBRL(perDayLeft)}/dia`;
    color = theme.success;
  } else {
    message = `Sobrou ${formatBRL(remaining)}`;
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/category', params: { id: category.id } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card>
        <Row style={styles.between}>
          <Row>
            <Dot color={category.color} />
            <ThemedText type="smallBold">{category.name}</ThemedText>
          </Row>
          <ThemedText type="small">
            <ThemedText type="smallBold">{formatBRL(spent)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {' '}
              / {formatBRL(limit)}
            </ThemedText>
          </ThemedText>
        </Row>
        <ProgressBar
          value={spent}
          max={limit}
          color={health === 'over' ? theme.danger : category.color}
          marker={showPace && limit > 0 ? expected / limit : undefined}
        />
        <ThemedText type="small" style={{ color }}>
          {message}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  centerCol: { alignItems: 'center' },
  gapTop: { marginTop: Spacing.one },
  pressed: { opacity: 0.7 },
});
