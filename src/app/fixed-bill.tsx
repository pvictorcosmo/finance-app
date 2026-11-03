import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Chips, DayStepper, Field, FormScreen } from '@/components/ui';
import { centsToInput, parseMoney } from '@/domain/money';
import { keyToPayment, paymentOptions, paymentToKey } from '@/domain/payment';
import { useFinance } from '@/store/finance-store';

export default function FixedBillForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const bills = useFinance((s) => s.fixedBills);
  const cards = useFinance((s) => s.cards);
  const saveFixedBill = useFinance((s) => s.saveFixedBill);
  const deleteFixedBill = useFinance((s) => s.deleteFixedBill);

  const existing = bills.find((b) => b.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : '');
  const [dueDay, setDueDay] = useState(existing?.dueDay ?? 10);
  const [paymentKey, setPaymentKey] = useState(existing ? paymentToKey(existing.payment) : 'pix');

  const cents = parseMoney(amount);
  const valid = name.trim().length > 0 && cents !== null && cents > 0;
  const onCard = paymentKey.startsWith('credit:');

  const save = () => {
    if (!valid || cents === null) return;
    saveFixedBill({ id: existing?.id, name: name.trim(), amount: cents, dueDay, payment: keyToPayment(paymentKey) });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(`Excluir ${existing.name}?`, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          deleteFixedBill(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: existing ? 'Editar conta fixa' : 'Nova conta fixa' }} />
      <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Aluguel, Internet, Academia" />
      <Field label="Valor mensal (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
      <DayStepper label={onCard ? 'Cobrada no cartão todo dia' : 'Vence todo dia'} value={dueDay} onChange={setDueDay} />
      <Chips label="Como paga" options={paymentOptions(cards)} value={paymentKey} onChange={setPaymentKey} />
      {onCard ? (
        <ThemedText type="small" themeColor="textSecondary">
          Será somada automaticamente na fatura do cartão todo mês.
        </ThemedText>
      ) : null}
      <Button label="Salvar" onPress={save} disabled={!valid} />
      {existing ? <Button label="Excluir conta fixa" variant="danger" onPress={remove} /> : null}
    </FormScreen>
  );
}
