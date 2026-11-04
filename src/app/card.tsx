import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { ColorPicker } from '@/components/color-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, DayStepper, Field, FormScreen } from '@/components/ui';
import { formatShort, todayISO } from '@/domain/dates';
import { invoiceForPurchase } from '@/domain/invoice';
import { centsToInput, parseMoney } from '@/domain/money';
import { CARD_COLORS } from '@/constants/series-colors';
import { CATEGORY_COLORS, useFinance } from '@/store/finance-store';

export default function CardForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const cards = useFinance((s) => s.cards);
  const expenses = useFinance((s) => s.expenses);
  const fixedBills = useFinance((s) => s.fixedBills);
  const saveCard = useFinance((s) => s.saveCard);
  const deleteCard = useFinance((s) => s.deleteCard);

  const existing = cards.find((c) => c.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[(cards.length + 4) % CATEGORY_COLORS.length]);
  const [closingDay, setClosingDay] = useState(existing?.closingDay ?? 1);
  const [dueDay, setDueDay] = useState(existing?.dueDay ?? 10);
  const [limitText, setLimitText] = useState(existing?.limit ? centsToInput(existing.limit) : '');

  const valid = name.trim().length > 0 && closingDay !== dueDay;
  const today = todayISO();
  const preview = invoiceForPurchase({ closingDay, dueDay }, today);

  const save = () => {
    if (!valid) return;
    const limit = parseMoney(limitText) ?? undefined;
    saveCard({ id: existing?.id, name: name.trim(), color, closingDay, dueDay, limit: limit || undefined });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    const used =
      expenses.filter((e) => e.payment.kind === 'credit' && e.payment.cardId === existing.id).length +
      fixedBills.filter((b) => b.payment.kind === 'credit' && b.payment.cardId === existing.id).length;
    Alert.alert(
      `Excluir ${existing.name}?`,
      used > 0 ? `${used} lançamento(s) estão neste cartão e vão aparecer como "Cartão removido".` : undefined,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            deleteCard(existing.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: existing ? 'Editar cartão' : 'Novo cartão' }} />
      <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Nubank, Itaú" />
      <ColorPicker value={color} onChange={setColor} colors={CARD_COLORS} />
      <DayStepper
        label="Dia de fechamento da fatura"
        value={closingDay}
        onChange={setClosingDay}
        hint="Compras feitas a partir deste dia entram na fatura seguinte."
      />
      <DayStepper label="Dia de vencimento" value={dueDay} onChange={setDueDay} />
      <Field
        label="Limite do cartão (opcional)"
        value={limitText}
        onChangeText={setLimitText}
        keyboardType="decimal-pad"
        placeholder="0,00"
      />
      {valid ? (
        <Card>
          <ThemedText type="small">
            Uma compra feita hoje entra na fatura que fecha em {formatShort(preview.closing)} e vence em{' '}
            <ThemedText type="smallBold">{formatShort(preview.due)}</ThemedText>.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Melhor dia para comprar: dia {closingDay}. É quando você ganha o maior prazo até pagar.
          </ThemedText>
        </Card>
      ) : closingDay === dueDay ? (
        <ThemedText type="small" themeColor="textSecondary">
          O fechamento e o vencimento precisam ser em dias diferentes.
        </ThemedText>
      ) : null}
      <Button label="Salvar" onPress={save} disabled={!valid} />
      {existing ? <Button label="Excluir cartão" variant="danger" onPress={remove} /> : null}
    </FormScreen>
  );
}
