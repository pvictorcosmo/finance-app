import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, Field, FormScreen } from '@/components/ui';
import { computeBudget } from '@/domain/budget';
import { cycleFor } from '@/domain/cycle';
import { formatShort, todayISO } from '@/domain/dates';
import { invoiceForPurchase } from '@/domain/invoice';
import { centsToInput, formatBRL, parseMoney } from '@/domain/money';
import { keyToPayment, paymentOptions, paymentToKey } from '@/domain/payment';
import { useTheme } from '@/hooks/use-theme';
import { useFinance, useFinanceData } from '@/store/finance-store';

export default function ExpenseForm() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const data = useFinanceData();
  const saveExpense = useFinance((s) => s.saveExpense);
  const deleteExpense = useFinance((s) => s.deleteExpense);

  const existing = data.expenses.find((e) => e.id === params.id);
  const lastPayment = data.expenses.at(-1)?.payment;

  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? data.categories[0]?.id);
  const [date, setDate] = useState(existing?.date ?? params.date ?? todayISO());
  const [paymentKey, setPaymentKey] = useState(() =>
    paymentToKey(existing?.payment ?? lastPayment ?? (data.cards[0] ? { kind: 'credit', cardId: data.cards[0].id } : { kind: 'debit' })),
  );

  const cents = parseMoney(amount);
  const payment = keyToPayment(paymentKey);
  const card = payment.kind === 'credit' ? data.cards.find((c) => c.id === payment.cardId) : undefined;
  const invoice = card ? invoiceForPurchase(card, date) : undefined;
  const category = data.categories.find((c) => c.id === categoryId);

  // Quanto sobra na categoria depois deste gasto, no ciclo da data escolhida.
  const categoryInfo = useMemo(() => {
    if (!category) return null;
    const cycle = cycleFor(date, data.settings.cycleStartDay);
    const others = { ...data, expenses: data.expenses.filter((e) => e.id !== existing?.id) };
    const status = computeBudget(others, cycle, todayISO()).categories.find((c) => c.category.id === category.id);
    if (!status || status.limit <= 0) return null;
    return { left: status.remaining - (cents ?? 0), limit: status.limit };
  }, [category, date, data, existing?.id, cents]);

  const canSave = cents !== null && cents > 0 && !!categoryId;

  const save = () => {
    if (!canSave || !categoryId) return;
    saveExpense({
      id: existing?.id,
      amount: cents,
      description: description.trim() || category?.name || 'Gasto',
      categoryId,
      date,
      payment,
    });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Excluir gasto?', existing.description, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          deleteExpense(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: existing ? 'Editar gasto' : 'Novo gasto' }} />

      <Field
        label="Valor (R$)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0,00"
        autoFocus={!existing}
      />
      <Field
        label="Descrição"
        value={description}
        onChangeText={setDescription}
        placeholder={category ? `Ex.: ${category.name}` : 'Ex.: Mercado'}
      />

      <Chips
        label="Categoria"
        options={data.categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
        value={categoryId}
        onChange={setCategoryId}
      />
      {categoryInfo ? (
        <ThemedText type="small" style={{ color: categoryInfo.left < 0 ? theme.danger : theme.textSecondary }}>
          {categoryInfo.left < 0
            ? `Com este gasto, ${category?.name} passa ${formatBRL(-categoryInfo.left)} do limite.`
            : `Depois deste gasto sobram ${formatBRL(categoryInfo.left)} de ${formatBRL(categoryInfo.limit)} em ${category?.name}.`}
        </ThemedText>
      ) : null}

      <DateField label="Data" value={date} onChange={setDate} />

      <Chips label="Pagamento" options={paymentOptions(data.cards)} value={paymentKey} onChange={setPaymentKey} />
      {invoice && card ? (
        <Card>
          <ThemedText type="small">
            Entra na fatura do <ThemedText type="smallBold">{card.name}</ThemedText> que fecha em{' '}
            {formatShort(invoice.closing)} e vence em <ThemedText type="smallBold">{formatShort(invoice.due)}</ThemedText>.
          </ThemedText>
        </Card>
      ) : null}
      {data.cards.length === 0 ? (
        <Button label="Cadastrar um cartão de crédito" variant="ghost" compact onPress={() => router.push('/card')} />
      ) : null}

      <Button label="Salvar" onPress={save} disabled={!canSave} />
      {existing ? <Button label="Excluir gasto" variant="danger" onPress={remove} /> : null}
    </FormScreen>
  );
}
