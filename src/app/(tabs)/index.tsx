import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Card,
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
import { computeBudget, expensesInCycle, type CategoryStatus } from '@/domain/budget';
import { dueDateInCycle, elapsedDays } from '@/domain/cycle';
import { formatShort, relativeDays } from '@/domain/dates';
import { formatBRL } from '@/domain/money';
import { paymentLabel } from '@/domain/payment';
import { useCycleNavigator } from '@/hooks/use-cycle';
import { useTheme } from '@/hooks/use-theme';
import { useFinance, useFinanceData } from '@/store/finance-store';

export default function SummaryScreen() {
  const theme = useTheme();
  const data = useFinanceData();
  const toggleFixedPaid = useFinance((s) => s.toggleFixedPaid);
  const { cycle, offset, setOffset, today, isCurrent } = useCycleNavigator();

  const budget = useMemo(() => computeBudget(data, cycle, today), [data, cycle, today]);
  const recent = useMemo(
    () =>
      expensesInCycle(data.expenses, cycle)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [data.expenses, cycle],
  );
  const bills = useMemo(
    () =>
      data.fixedBills
        .map((bill) => ({ bill, due: dueDateInCycle(cycle, bill.dueDay) }))
        .sort((a, b) => a.due.localeCompare(b.due)),
    [data.fixedBills, cycle],
  );
  const paid = data.fixedPaid[cycle.start] ?? [];
  const leftover = budget.free - budget.spent;

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
        {!isCurrent ? <Button label="Voltar para o ciclo atual" variant="ghost" compact onPress={() => setOffset(0)} /> : null}
      </Card>

      <Card>
        <KeyValue label="Salário" value={formatBRL(budget.salary)} />
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
          label={leftover >= 0 ? 'Ainda disponível' : 'Passou do livre'}
          value={formatBRL(Math.abs(leftover))}
          strong
          color={leftover >= 0 ? theme.success : theme.danger}
        />
        {budget.unallocated < 0 ? (
          <ThemedText type="small" style={{ color: theme.warning }}>
            Os limites das categorias somam {formatBRL(-budget.unallocated)} a mais do que o livre.
          </ThemedText>
        ) : budget.unallocated > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {formatBRL(budget.unallocated)} do livre não está em nenhuma categoria (sobra/reserva).
          </ThemedText>
        ) : null}
      </Card>

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
                      : `${isPaid ? 'Paga' : overdue ? 'Venceu' : 'Vence'} ${formatShort(due)}${
                          isPaid ? '' : ` (${relativeDays(due, today)})`
                        } · ${paymentLabel(bill.payment, data.cards)}`
                  }
                  right={
                    <Row>
                      <ThemedText type="smallBold" style={overdue ? { color: theme.danger } : undefined}>
                        {formatBRL(bill.amount)}
                      </ThemedText>
                      {!onCard ? (
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isPaid }}
                          accessibilityLabel={`Marcar ${bill.name} como paga`}
                          hitSlop={8}
                          onPress={() => toggleFixedPaid(cycle.start, bill.id)}
                          style={[
                            styles.check,
                            { borderColor: isPaid ? theme.success : theme.border },
                            isPaid && { backgroundColor: theme.success },
                          ]}>
                          {isPaid ? <ThemedText style={{ color: theme.onPrimary }}>✓</ThemedText> : null}
                        </Pressable>
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
          {recent.map((e) => {
            const cat = data.categories.find((c) => c.id === e.categoryId);
            return (
              <ListItem
                key={e.id}
                color={cat?.color ?? theme.textSecondary}
                title={e.description}
                subtitle={`${formatShort(e.date)} · ${cat?.name ?? 'Sem categoria'} · ${paymentLabel(e.payment, data.cards)}`}
                right={formatBRL(e.amount)}
                onPress={() => router.push({ pathname: '/expense', params: { id: e.id } })}
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
    message = `Estourou ${formatBRL(-remaining)}`;
    color = theme.danger;
  } else if (health === 'attention' && showPace) {
    message = `Acima do ritmo: o normal até hoje seria ${formatBRL(expected)}`;
    color = theme.warning;
  } else if (showPace) {
    message = `Dentro do ritmo · pode gastar ${formatBRL(perDayLeft)}/dia`;
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
  check: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
