import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AmountKeypad } from '@/components/amount-keypad';
import { DateField } from '@/components/date-field';
import { categoryIcon } from '@/components/icon';
import { MoneyText } from '@/components/money-text';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, DayStepper, Field, FormScreen } from '@/components/ui';
import { computeBudget } from '@/domain/budget';
import { budgetDate, expenseCharges, installmentCount } from '@/domain/charges';
import { cycleFor } from '@/domain/cycle';
import { formatMonthYear, formatShort, todayISO } from '@/domain/dates';
import { centsToInput, formatBRL, parseMoney } from '@/domain/money';
import { keyToPayment, paymentOptions, paymentToKey } from '@/domain/payment';
import { readDraftParam } from '@/domain/quick-parse';
import { autocomplete, buildHistoryIndex, suggestByKeywords, suggestFromHistory } from '@/domain/suggestions';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFinance, useFinanceData } from '@/store/finance-store';
import { haptic } from '@/ui/haptics';

type AmountMode = 'total' | 'installment';

export default function ExpenseForm() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; date?: string; draft?: string; repeat?: string }>();
  const data = useFinanceData();
  const saveExpense = useFinance((s) => s.saveExpense);
  const deleteExpense = useFinance((s) => s.deleteExpense);

  const existing = data.expenses.find((e) => e.id === params.id);
  // "Repeat": a copy of another expense, dated today. "Draft": pre-filled by the assistant.
  const repeated = data.expenses.find((e) => e.id === params.repeat);
  const draft = readDraftParam(params.draft);
  const source = existing ?? repeated;
  const lastPayment = data.expenses.at(-1)?.payment;
  const index = useMemo(() => buildHistoryIndex(data.expenses), [data.expenses]);

  const [amount, setAmount] = useState(() => {
    const cents = source?.amount ?? draft?.amount;
    return cents ? centsToInput(cents) : '';
  });
  const [amountMode, setAmountMode] = useState<AmountMode>('total');
  const [description, setDescription] = useState(source?.description ?? draft?.description ?? '');
  const [categoryId, setCategoryId] = useState(
    source?.categoryId ?? draft?.categoryId ?? (draft ? undefined : data.categories[0]?.id),
  );
  const [date, setDate] = useState(existing?.date ?? draft?.date ?? params.date ?? todayISO());
  const [installments, setInstallments] = useState(source?.installments ?? draft?.installments ?? 1);
  const [paymentKey, setPaymentKey] = useState(() =>
    source
      ? paymentToKey(source.payment)
      : (draft?.paymentKey ??
        paymentToKey(
          lastPayment ?? (data.cards[0] ? { kind: 'credit', cardId: data.cards[0].id } : { kind: 'debit' }),
        )),
  );
  // Once the user picks category/payment by hand, suggestions stop overriding them.
  const [touched, setTouched] = useState({
    category: !!source || !!draft?.categoryId,
    payment: !!source || !!draft?.paymentKey,
  });
  const [suggested, setSuggested] = useState<string | null>(null);
  // New expenses open with the keypad; editing shows it after tapping the amount.
  const [showKeypad, setShowKeypad] = useState(!existing);

  /** Updates the description and fills category/payment from history (or keywords). */
  const changeDescription = (text: string) => {
    setDescription(text);
    const fromHistory = suggestFromHistory(index, text);
    const notes: string[] = [];
    if (!touched.category) {
      const byHistory =
        fromHistory && data.categories.some((c) => c.id === fromHistory.categoryId) ? fromHistory.categoryId : undefined;
      const next = byHistory ?? suggestByKeywords(text, data.categories);
      if (next && next !== categoryId) {
        setCategoryId(next);
        notes.push('categoria');
      }
    }
    if (!touched.payment && fromHistory && fromHistory.paymentKey !== paymentKey) {
      setPaymentKey(fromHistory.paymentKey);
      notes.push('pagamento');
    }
    if (notes.length) setSuggested(`${notes.join(' e ')} sugerid${notes.length > 1 ? 'os' : 'a'} pelo seu histórico`);
  };
  const completions = useMemo(() => autocomplete(index, description), [index, description]);

  const payment = keyToPayment(paymentKey);
  const isCredit = payment.kind === 'credit';
  const count = installmentCount({ payment, installments });
  const typed = parseMoney(amount);
  const total = typed === null ? null : amountMode === 'installment' && count > 1 ? typed * count : typed;
  const card = payment.kind === 'credit' ? data.cards.find((c) => c.id === payment.cardId) : undefined;
  const category = data.categories.find((c) => c.id === categoryId);

  // Simula o gasto para mostrar parcelas, faturas e o impacto na categoria.
  const preview = (() => {
    if (total === null || total <= 0 || !categoryId) return null;
    const now = new Date().toISOString();
    const draft = {
      id: existing?.id ?? 'preview',
      description: description.trim() || category?.name || 'Gasto',
      amount: total,
      date,
      categoryId,
      payment,
      installments: count,
      createdAt: now,
      updatedAt: now,
    };
    const charges = expenseCharges(draft, data.cards);

    // The category impact is shown for the cycle the (first) charge weighs on.
    const cycle = cycleFor(budgetDate(charges[0], data.settings.cardBudgetBasis), data.settings.cycleStartDay);
    const others = { ...data, expenses: [...data.expenses.filter((e) => e.id !== existing?.id), draft] };
    const status = computeBudget(others, cycle, todayISO()).categories.find((c) => c.category.id === categoryId);
    return { charges, status };
  })();

  const canSave = total !== null && total > 0 && !!categoryId;
  const typedCents = typed ?? 0;
  const amountLabel = count > 1 ? (amountMode === 'total' ? 'Valor total' : 'Valor de cada parcela') : 'Valor';

  const save = () => {
    if (!canSave || !categoryId || total === null) return;
    haptic.success();
    saveExpense({
      id: existing?.id,
      amount: total,
      description: description.trim() || category?.name || 'Gasto',
      categoryId,
      date,
      payment,
      installments: count,
    });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    haptic.warning();
    Alert.alert(
      'Excluir gasto?',
      existing.installments && existing.installments > 1
        ? `${existing.description} — remove todas as ${existing.installments} parcelas.`
        : existing.description,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            deleteExpense(existing.id);
            router.back();
          },
        },
      ],
    );
  };

  const first = preview?.charges[0];
  const last = preview?.charges.at(-1);
  const left = preview?.status && preview.status.limit > 0 ? preview.status.remaining : null;

  return (
    <FormScreen footer={<Button label="Salvar" onPress={save} disabled={!canSave} />}>
      <Stack.Screen options={{ title: existing ? 'Editar gasto' : repeated ? 'Repetir gasto' : 'Novo gasto' }} />
      {!existing ? (
        <Button
          label="Digitar em uma frase"
          icon="sparkles"
          variant="secondary"
          compact
          onPress={() => router.replace('/assistant')}
        />
      ) : null}
      {/* Amount: big display + own keypad (tap the amount to show it again). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${amountLabel}: ${formatBRL(typedCents)}. Toque para editar`}
        onPress={() => setShowKeypad(true)}
        style={styles.amount}>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.amountLabel}>
          {amountLabel}
        </ThemedText>
        <MoneyText value={typedCents} size="hero" reveal themeColor={typedCents ? 'text' : 'textSecondary'} />
      </Pressable>
      {showKeypad ? (
        <AmountKeypad value={typedCents} onChange={(c) => setAmount(c ? centsToInput(c) : '')} />
      ) : null}

      <Chips
        label="Categoria"
        options={data.categories.map((c) => ({ value: c.id, label: c.name, color: c.color, icon: categoryIcon(c) }))}
        value={categoryId}
        onChange={(id) => {
          setCategoryId(id);
          setTouched((t) => ({ ...t, category: true }));
          setSuggested(null);
        }}
      />
      {suggested ? (
        <ThemedText type="caption" themeColor="textSecondary">
          ✨ {suggested.charAt(0).toUpperCase() + suggested.slice(1)}.
        </ThemedText>
      ) : null}
      {left !== null && category ? (
        <ThemedText type="small" style={{ color: left < 0 ? theme.danger : theme.textSecondary }}>
          {left < 0
            ? `! Com este gasto, ${category.name} passa ${formatBRL(-left)} do limite neste ciclo.`
            : `Depois deste gasto sobram ${formatBRL(left)} de ${formatBRL(preview!.status!.limit)} em ${category.name} neste ciclo.`}
        </ThemedText>
      ) : null}

      <Chips
        label="Pagamento"
        options={paymentOptions(data.cards)}
        value={paymentKey}
        onChange={(k) => {
          setPaymentKey(k);
          setTouched((t) => ({ ...t, payment: true }));
        }}
      />
      {data.cards.length === 0 ? (
        <Button label="Cadastrar um cartão de crédito" variant="ghost" compact onPress={() => router.push('/card')} />
      ) : null}

      {isCredit ? (
        <DayStepper
          label="Parcelas"
          value={installments}
          onChange={setInstallments}
          min={1}
          max={24}
          format={(n) => (n === 1 ? 'À vista' : `${n}x`)}
        />
      ) : null}
      {count > 1 ? (
        <Chips
          options={[
            { value: 'total', label: 'Digitar valor total' },
            { value: 'installment', label: 'Digitar valor da parcela' },
          ]}
          value={amountMode}
          onChange={setAmountMode}
        />
      ) : null}

      <Field
        label="Descrição"
        value={description}
        // The system keyboard takes the keypad's place while typing text.
        onFocus={() => setShowKeypad(false)}
        onChangeText={changeDescription}
        placeholder={category ? `Ex.: ${category.name}` : 'Ex.: Mercado'}
      />
      {completions.length ? (
        <View style={styles.completions}>
          {completions.map((c) => (
            <Pressable
              key={c.description}
              accessibilityRole="button"
              onPress={() => {
                changeDescription(c.description);
                if (!amount) setAmount(centsToInput(c.lastAmount));
              }}
              style={({ pressed }) => [styles.completion, { backgroundColor: theme.primarySoft }, pressed && styles.pressed]}>
              <ThemedText type="caption" style={{ color: theme.accent }}>
                {c.description} · {formatBRL(c.lastAmount)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <DateField label="Data da compra" value={date} onChange={setDate} />

      {card && first ? (
        <Card>
          {count > 1 && last ? (
            <>
              <ThemedText type="small">
                <ThemedText type="smallBold">
                  {count}x de {formatBRL(last.amount)}
                </ThemedText>{' '}
                (total {formatBRL(total ?? 0)}) no {card.name}.
              </ThemedText>
              <ThemedText type="small">
                1ª parcela na fatura que vence em {formatShort(first.invoiceDue!)}, última em{' '}
                {formatMonthYear(last.invoiceDue!)}.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Cada parcela conta no orçamento do ciclo em que é cobrada.
              </ThemedText>
            </>
          ) : (
            <ThemedText type="small">
              Entra na fatura do <ThemedText type="smallBold">{card.name}</ThemedText> que vence em{' '}
              <ThemedText type="smallBold">{formatShort(first.invoiceDue!)}</ThemedText>.
            </ThemedText>
          )}
        </Card>
      ) : null}

      {existing ? (
        <Button
          label="Repetir para hoje"
          icon="repeat"
          variant="secondary"
          onPress={() => router.replace({ pathname: '/expense', params: { repeat: existing.id } })}
        />
      ) : null}
      {existing ? <Button label="Excluir gasto" variant="danger" onPress={remove} /> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  amount: { alignItems: 'center', paddingVertical: Spacing.two, gap: Spacing.one },
  amountLabel: { textTransform: 'uppercase', letterSpacing: 0.6 },
  completions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: -Spacing.one },
  completion: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  pressed: { opacity: 0.6 },
});
