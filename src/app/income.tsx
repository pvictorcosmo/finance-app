import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Chips, Field, FormScreen } from '@/components/ui';
import { addDays, parseISO, todayISO } from '@/domain/dates';
import { INCOME_KINDS, incomeKindLabel } from '@/domain/labels';
import { centsToInput, parseMoney } from '@/domain/money';
import type { IncomeDestination, IncomeKind } from '@/domain/types';
import { useFinance } from '@/store/finance-store';

export default function IncomeForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const incomes = useFinance((s) => s.incomes);
  const saveIncome = useFinance((s) => s.saveIncome);
  const deleteIncome = useFinance((s) => s.deleteIncome);
  const existing = incomes.find((i) => i.id === id);

  const [kind, setKind] = useState<IncomeKind>(existing?.kind ?? 'freela');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : '');
  const [recurrence, setRecurrence] = useState(existing?.recurrence ?? 'once');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [destination, setDestination] = useState<IncomeDestination>(existing?.destination ?? 'budget');

  const cents = parseMoney(amount);
  const valid = cents !== null && cents > 0;
  const kindLabel = incomeKindLabel(kind);

  const save = () => {
    if (!valid || cents === null) return;
    saveIncome({
      id: existing?.id,
      kind,
      description: description.trim() || kindLabel,
      amount: cents,
      recurrence,
      date,
      endDate: recurrence === 'monthly' ? existing?.endDate : undefined,
      destination,
    });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Cancelar', style: 'cancel' },
    ];
    if (existing.recurrence === 'monthly' && existing.date < todayISO()) {
      buttons.push({
        text: 'Parar de hoje em diante',
        onPress: () => {
          saveIncome({ ...existing, endDate: addDays(todayISO(), -1) });
          router.back();
        },
      });
    }
    buttons.push({
      text: 'Excluir tudo',
      style: 'destructive',
      onPress: () => {
        deleteIncome(existing.id);
        router.back();
      },
    });
    Alert.alert(
      `Remover ${existing.description}?`,
      existing.recurrence === 'monthly'
        ? '"Parar" mantém os meses anteriores no histórico. "Excluir tudo" apaga também do passado.'
        : undefined,
      buttons,
    );
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: existing ? 'Editar renda' : 'Renda extra' }} />
      <Chips label="Tipo" options={INCOME_KINDS} value={kind} onChange={setKind} />
      <Field label="Descrição" value={description} onChangeText={setDescription} placeholder={`Ex.: ${kindLabel}`} />
      <Field label="Valor (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
      <Chips
        label="Frequência"
        options={[
          { value: 'once', label: 'Só uma vez' },
          { value: 'monthly', label: 'Todo mês' },
        ]}
        value={recurrence}
        onChange={setRecurrence}
      />
      <DateField label={recurrence === 'once' ? 'Quando recebe' : 'A partir de (repete todo dia igual)'} value={date} onChange={setDate} />
      {recurrence === 'monthly' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Vai contar todo dia {parseISO(date).d} de cada mês.
          {existing?.endDate ? ` Encerrada em ${existing.endDate.split('-').reverse().join('/')}.` : ''}
        </ThemedText>
      ) : null}
      <Chips
        label="Para onde vai"
        options={[
          { value: 'budget', label: 'Somar no livre do ciclo' },
          { value: 'savings', label: 'Direto para a poupança' },
        ]}
        value={destination}
        onChange={setDestination}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {destination === 'budget'
          ? 'Aumenta o valor livre do ciclo (e os limites em % das categorias).'
          : 'Não mexe no orçamento: entra direto na poupança acumulada.'}
      </ThemedText>
      <Button label="Salvar" onPress={save} disabled={!valid} />
      {existing ? <Button label="Remover renda" variant="danger" onPress={remove} /> : null}
    </FormScreen>
  );
}
