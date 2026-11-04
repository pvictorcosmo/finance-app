import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, DayStepper, Field, FormScreen, KeyValue } from '@/components/ui';
import { addDays, addMonthsISO, formatShort, todayISO } from '@/domain/dates';
import { centsToInput, formatBRL, parseMoney } from '@/domain/money';
import { keyToPayment, paymentLabel, paymentOptions, paymentToKey } from '@/domain/payment';
import { useTheme } from '@/hooks/use-theme';
import { useFinance } from '@/store/finance-store';

/** Chave do seletor para "só um combinado" (nenhum dinheiro sai). */
const NONE = 'none';

export default function AgreementForm() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const agreements = useFinance((s) => s.agreements);
  const receivables = useFinance((s) => s.receivables);
  const cards = useFinance((s) => s.cards);
  const saveAgreement = useFinance((s) => s.saveAgreement);
  const deleteAgreement = useFinance((s) => s.deleteAgreement);
  const existing = agreements.find((a) => a.id === id);
  const today = todayISO();

  const [person, setPerson] = useState(existing?.person ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [theyPayText, setTheyPayText] = useState(existing ? centsToInput(existing.theyPay) : '');
  const [iPayText, setIPayText] = useState(existing ? centsToInput(existing.iPay) : '');
  const [methodKey, setMethodKey] = useState(existing?.iPayMethod ? paymentToKey(existing.iPayMethod) : NONE);
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [months, setMonths] = useState(existing?.months ?? 0);

  const knownPeople = useMemo(() => {
    const names = new Map<string, string>();
    for (const x of [...receivables, ...agreements]) names.set(x.person.trim().toLocaleLowerCase('pt-BR'), x.person.trim());
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [receivables, agreements]);

  const theyPay = parseMoney(theyPayText) ?? 0;
  const iPay = parseMoney(iPayText) ?? 0;
  const net = theyPay - iPay;
  const name = person.trim() || 'A pessoa';
  const method = methodKey === NONE ? null : keyToPayment(methodKey);
  const valid = person.trim().length > 0 && (theyPay > 0 || iPay > 0);

  const save = () => {
    if (!valid) return;
    saveAgreement({
      id: existing?.id,
      person: person.trim(),
      description: description.trim() || 'Acordo mensal',
      theyPay,
      iPay,
      iPayMethod: method,
      startDate,
      months: months > 0 ? months : undefined,
      endDate: existing?.endDate,
      settled: existing?.settled ?? {},
    });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Cancelar', style: 'cancel' },
    ];
    if (existing.startDate < today && !existing.endDate) {
      buttons.push({
        text: 'Encerrar a partir de hoje',
        onPress: () => {
          saveAgreement({ ...existing, endDate: addDays(today, -1) });
          router.back();
        },
      });
    }
    buttons.push({
      text: 'Excluir tudo',
      style: 'destructive',
      onPress: () => {
        deleteAgreement(existing.id);
        router.back();
      },
    });
    Alert.alert(
      `Remover acordo com ${existing.person}?`,
      '"Encerrar" mantém os meses anteriores. "Excluir tudo" apaga também o histórico e as cobranças no cartão.',
      buttons,
    );
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: existing ? 'Editar acordo' : 'Acordo mensal' }} />
      <ThemedText type="small" themeColor="textSecondary">
        Para quando uma pessoa te paga um valor todo mês e você paga outro por ela: um abate o outro e o app mostra o
        saldo.
      </ThemedText>

      <Field label="Com quem" value={person} onChangeText={setPerson} placeholder="Nome da pessoa" />
      {knownPeople.length > 0 ? (
        <Chips
          options={knownPeople.map((p) => ({ value: p, label: p }))}
          value={knownPeople.find((p) => p.toLocaleLowerCase('pt-BR') === person.trim().toLocaleLowerCase('pt-BR'))}
          onChange={setPerson}
        />
      ) : null}
      <Field
        label="Descrição"
        value={description}
        onChangeText={setDescription}
        placeholder="Ex.: parcela do celular × Netflix dela"
      />

      <Field
        label={`${name} te paga por mês (R$)`}
        value={theyPayText}
        onChangeText={setTheyPayText}
        keyboardType="decimal-pad"
        placeholder="0,00"
      />
      <Field
        label={`Você paga por ${person.trim() || 'ela'} por mês (R$)`}
        value={iPayText}
        onChangeText={setIPayText}
        keyboardType="decimal-pad"
        placeholder="0,00"
      />
      <Chips
        label="Como você paga a sua parte"
        options={[{ value: NONE, label: 'Só combinado (abate)' }, ...paymentOptions(cards)]}
        value={methodKey}
        onChange={setMethodKey}
      />

      <DateField label="Primeiro mês (o dia se repete)" value={startDate} onChange={setStartDate} />
      <DayStepper
        label="Duração"
        value={months}
        onChange={setMonths}
        min={0}
        max={60}
        format={(n) => (n === 0 ? 'Sem prazo' : `${n} ${n === 1 ? 'mês' : 'meses'}`)}
        hint={months > 0 ? `Último mês: ${formatShort(addMonthsISO(startDate, months - 1))}` : 'Vale até você encerrar.'}
      />

      <Card>
        <KeyValue label={`${name} te paga`} value={formatBRL(theyPay)} />
        <KeyValue label="Você paga por ela" value={`− ${formatBRL(iPay)}`} />
        <KeyValue
          label={net > 0 ? `${name} te deve por mês` : net < 0 ? 'Você deve por mês' : 'Saldo do mês'}
          value={net === 0 ? 'Quites' : formatBRL(Math.abs(net))}
          strong
          color={net > 0 ? theme.success : net < 0 ? theme.warning : undefined}
        />
        {net === 0 && (theyPay > 0 || iPay > 0) ? (
          <ThemedText type="caption" themeColor="textSecondary">
            Um valor paga o outro: cada mês fica compensado sozinho.
          </ThemedText>
        ) : null}
        {method?.kind === 'credit' && iPay > 0 ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {formatBRL(iPay)} entra na fatura do {paymentLabel(method, cards)} todo mês, mas não conta nos limites das
            suas categorias.
          </ThemedText>
        ) : null}
      </Card>

      <Button label="Salvar" onPress={save} disabled={!valid} />
      {existing ? <Button label="Remover acordo" variant="danger" onPress={remove} /> : null}
    </FormScreen>
  );
}
