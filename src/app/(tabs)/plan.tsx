import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, DayStepper, Field, KeyValue, ListItem, Screen, SectionHeader } from '@/components/ui';
import { categoryLimit, incomesInCycle } from '@/domain/budget';
import { cycleFor } from '@/domain/cycle';
import { formatShort, parseISO, todayISO } from '@/domain/dates';
import { incomeKindLabel } from '@/domain/labels';
import { centsToInput, formatBRL, parseMoney } from '@/domain/money';
import { paymentLabel } from '@/domain/payment';
import { useTheme } from '@/hooks/use-theme';
import { useFinance, useFinanceData } from '@/store/finance-store';

export default function PlanScreen() {
  const theme = useTheme();
  const data = useFinanceData();
  const setSalary = useFinance((s) => s.setSalary);
  const setCycleStartDay = useFinance((s) => s.setCycleStartDay);
  const { salary, cycleStartDay } = data.settings;

  const [salaryText, setSalaryText] = useState(salary ? centsToInput(salary) : '');
  const commitSalary = () => {
    const value = parseMoney(salaryText);
    if (value !== null) setSalary(value);
    setSalaryText(value ? centsToInput(value) : '');
  };

  const cycle = useMemo(() => cycleFor(todayISO(), cycleStartDay), [cycleStartDay]);
  const extras = incomesInCycle(data.incomes, cycle);
  const fixed = data.fixedBills.reduce((s, b) => s + b.amount, 0);
  const free = salary + extras.toBudget - fixed;
  const allocated = data.categories.reduce((s, c) => s + categoryLimit(c, free), 0);
  const unallocated = free - allocated;
  const incomes = [...data.incomes].sort((a, b) => b.date.localeCompare(a.date));
  const bills = [...data.fixedBills].sort((a, b) => a.dueDay - b.dueDay);

  return (
    <Screen title="Planejar" subtitle="Salário − contas fixas = o que você divide entre as categorias">
      <SectionHeader title="Renda e ciclo" />
      <Card>
        <Field
          label="Salário líquido (R$)"
          value={salaryText}
          onChangeText={setSalaryText}
          onEndEditing={commitSalary}
          onBlur={commitSalary}
          keyboardType="decimal-pad"
          placeholder="0,00"
          returnKeyType="done"
        />
        <DayStepper
          label="O mês financeiro começa no dia"
          value={cycleStartDay}
          onChange={setCycleStartDay}
          hint={`Ciclo atual: ${formatShort(cycle.start)} a ${formatShort(cycle.end)}. Use o dia em que você recebe.`}
        />
      </Card>

      <Card>
        <KeyValue label="Salário" value={formatBRL(salary)} />
        {extras.toBudget > 0 ? (
          <KeyValue label="Renda extra (este ciclo)" value={`+ ${formatBRL(extras.toBudget)}`} />
        ) : null}
        <KeyValue label="Contas fixas" value={`− ${formatBRL(fixed)}`} />
        <KeyValue label="Livre para dividir" value={formatBRL(free)} strong />
        <KeyValue label="Distribuído nas categorias" value={formatBRL(allocated)} />
        <KeyValue
          label={unallocated >= 0 ? 'Sem destino (reserva)' : 'Distribuído a mais'}
          value={formatBRL(Math.abs(unallocated))}
          strong
          color={unallocated >= 0 ? theme.success : theme.danger}
        />
      </Card>

      <SectionHeader
        title="Renda extra"
        action={<Button label="＋ Adicionar" variant="ghost" compact onPress={() => router.push('/income')} />}
      />
      <Card>
        {incomes.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Freelas, 13º, vale-refeição, bônus... Você escolhe se soma no livre do ciclo ou vai direto para a
            poupança.
          </ThemedText>
        ) : (
          incomes.map((income) => {
            const when =
              income.recurrence === 'monthly'
                ? `Todo dia ${parseISO(income.date).d}${income.endDate ? ' (encerrada)' : ''}`
                : formatShort(income.date);
            return (
              <ListItem
                key={income.id}
                title={income.description}
                subtitle={`${incomeKindLabel(income.kind)} · ${when} · ${
                  income.destination === 'savings' ? 'poupança' : 'soma no livre'
                }`}
                right={`+ ${formatBRL(income.amount)}`}
                onPress={() => router.push({ pathname: '/income', params: { id: income.id } })}
              />
            );
          })
        )}
      </Card>

      <SectionHeader
        title="Contas fixas"
        action={<Button label="＋ Adicionar" variant="ghost" compact onPress={() => router.push('/fixed-bill')} />}
      />
      <Card>
        {bills.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Aluguel, internet, academia, assinaturas... tudo que sai todo mês com valor certo.
          </ThemedText>
        ) : (
          bills.map((bill) => (
            <ListItem
              key={bill.id}
              title={bill.name}
              subtitle={`Dia ${bill.dueDay} · ${paymentLabel(bill.payment, data.cards)}`}
              right={formatBRL(bill.amount)}
              onPress={() => router.push({ pathname: '/fixed-bill', params: { id: bill.id } })}
            />
          ))
        )}
      </Card>

      <SectionHeader
        title="Categorias (gastos variáveis)"
        action={<Button label="＋ Adicionar" variant="ghost" compact onPress={() => router.push('/category')} />}
      />
      <Card>
        {data.categories.map((cat) => {
          const limit = categoryLimit(cat, free);
          return (
            <ListItem
              key={cat.id}
              color={cat.color}
              title={cat.name}
              subtitle={cat.limitType === 'percent' ? `${cat.limitValue}% do livre` : 'Valor fixo'}
              right={formatBRL(limit)}
              onPress={() => router.push({ pathname: '/category', params: { id: cat.id } })}
            />
          );
        })}
      </Card>

      <SectionHeader title="Cartões" />
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {data.cards.length === 0
            ? 'Nenhum cartão cadastrado.'
            : data.cards.map((c) => c.name).join(', ')}
        </ThemedText>
        <Button label="Gerenciar cartões" variant="secondary" onPress={() => router.navigate('/cards')} />
      </Card>
    </Screen>
  );
}
