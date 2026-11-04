import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, DayStepper, Field, FormScreen } from '@/components/ui';
import { splitInstallments } from '@/domain/charges';
import { addMonthsISO, formatShort, todayISO } from '@/domain/dates';
import { centsToInput, formatBRL, parseMoney } from '@/domain/money';
import { useFinance } from '@/store/finance-store';

export default function ReceivableForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const receivables = useFinance((s) => s.receivables);
  const saveReceivable = useFinance((s) => s.saveReceivable);
  const deleteReceivable = useFinance((s) => s.deleteReceivable);
  const existing = receivables.find((r) => r.id === id);
  const today = todayISO();

  const [person, setPerson] = useState(existing?.person ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : '');
  const [lentDate, setLentDate] = useState(existing?.lentDate ?? today);
  const [firstDue, setFirstDue] = useState(existing?.firstDue ?? addMonthsISO(today, 1));
  const [installments, setInstallments] = useState(existing?.installments ?? 1);

  // Pessoas já cadastradas, para escolher com um toque.
  const knownPeople = useMemo(() => {
    const names = new Map<string, string>();
    for (const r of receivables) names.set(r.person.trim().toLocaleLowerCase('pt-BR'), r.person.trim());
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [receivables]);

  const cents = parseMoney(amount);
  const valid = person.trim().length > 0 && cents !== null && cents > 0;
  const parts = cents ? splitInstallments(cents, installments) : [];
  const receivedCount = existing ? Object.keys(existing.received).length : 0;

  const save = () => {
    if (!valid || cents === null) return;
    // Se diminuiu o número de parcelas, descarta marcações de parcelas que não existem mais.
    const received = Object.fromEntries(
      Object.entries(existing?.received ?? {}).filter(([index]) => Number(index) < installments),
    );
    saveReceivable({
      id: existing?.id,
      person: person.trim(),
      description: description.trim() || 'Empréstimo',
      amount: cents,
      lentDate,
      firstDue,
      installments,
      received,
    });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(`Excluir dívida de ${existing.person}?`, existing.description, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          deleteReceivable(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: existing ? 'Editar devedor' : 'Novo devedor' }} />
      <Field label="Quem te deve" value={person} onChangeText={setPerson} placeholder="Nome da pessoa" />
      {knownPeople.length > 0 ? (
        <Chips
          options={knownPeople.map((p) => ({ value: p, label: p }))}
          value={knownPeople.find((p) => p.toLocaleLowerCase('pt-BR') === person.trim().toLocaleLowerCase('pt-BR'))}
          onChange={setPerson}
        />
      ) : null}
      <Field label="Do quê" value={description} onChangeText={setDescription} placeholder="Ex.: Show, conta do bar, empréstimo" />
      <Field label="Valor total (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
      <DateField label="Quando você emprestou / pagou" value={lentDate} onChange={setLentDate} />
      <DayStepper
        label="Vai pagar em"
        value={installments}
        onChange={setInstallments}
        min={1}
        max={24}
        format={(n) => (n === 1 ? 'De uma vez' : `${n}x`)}
      />
      <DateField label={installments > 1 ? 'Primeiro pagamento' : 'Quando vai pagar'} value={firstDue} onChange={setFirstDue} />
      {installments > 1 && cents ? (
        <Card>
          <ThemedText type="small">
            {installments}x de <ThemedText type="smallBold">{formatBRL(parts[parts.length - 1])}</ThemedText>, todo mês de{' '}
            {formatShort(firstDue)} até {formatShort(addMonthsISO(firstDue, installments - 1))}.
          </ThemedText>
        </Card>
      ) : null}
      {existing && receivedCount > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {receivedCount} pagamento(s) já marcado(s) como recebido(s).
        </ThemedText>
      ) : null}
      <Button label="Salvar" onPress={save} disabled={!valid} />
      {existing ? <Button label="Excluir" variant="danger" onPress={remove} /> : null}
    </FormScreen>
  );
}
