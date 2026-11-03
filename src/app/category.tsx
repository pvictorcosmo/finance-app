import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { ColorPicker } from '@/components/color-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, Field, FormScreen } from '@/components/ui';
import { categoryLimit } from '@/domain/budget';
import { centsToInput, formatBRL, parseMoney } from '@/domain/money';
import type { LimitType } from '@/domain/types';
import { CATEGORY_COLORS, useFinance } from '@/store/finance-store';

export default function CategoryForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const categories = useFinance((s) => s.categories);
  const expenses = useFinance((s) => s.expenses);
  const salary = useFinance((s) => s.settings.salary);
  const fixedBills = useFinance((s) => s.fixedBills);
  const saveCategory = useFinance((s) => s.saveCategory);
  const deleteCategory = useFinance((s) => s.deleteCategory);

  const existing = categories.find((c) => c.id === id);
  const free = salary - fixedBills.reduce((s, b) => s + b.amount, 0);

  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]);
  const [limitType, setLimitType] = useState<LimitType>(existing?.limitType ?? 'amount');
  const [valueText, setValueText] = useState(() => {
    if (!existing) return '';
    return existing.limitType === 'amount' ? centsToInput(existing.limitValue) : String(existing.limitValue);
  });

  const parsed =
    limitType === 'amount' ? parseMoney(valueText) : Number(valueText.replace(',', '.')) || null;
  const valid = name.trim().length > 0 && parsed !== null && parsed >= 0 && (limitType === 'amount' || parsed <= 100);
  const preview = parsed !== null ? categoryLimit({ limitType, limitValue: parsed }, free) : 0;

  const save = () => {
    if (!valid || parsed === null) return;
    saveCategory({ id: existing?.id, name: name.trim(), color, limitType, limitValue: parsed });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    const count = expenses.filter((e) => e.categoryId === existing.id).length;
    Alert.alert(
      `Excluir ${existing.name}?`,
      count > 0 ? `${count} gasto(s) desta categoria vão ficar sem categoria.` : undefined,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            deleteCategory(existing.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: existing ? 'Editar categoria' : 'Nova categoria' }} />
      <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Uber, Mercado, Lazer" />
      <ColorPicker value={color} onChange={setColor} />

      <Chips
        label="Como definir o limite"
        options={[
          { value: 'amount', label: 'Valor em R$' },
          { value: 'percent', label: '% do livre' },
        ]}
        value={limitType}
        onChange={(t) => {
          setLimitType(t);
          setValueText('');
        }}
      />
      <Field
        label={limitType === 'amount' ? 'Limite por ciclo (R$)' : 'Porcentagem do valor livre (%)'}
        value={valueText}
        onChangeText={setValueText}
        keyboardType="decimal-pad"
        placeholder={limitType === 'amount' ? '0,00' : 'Ex.: 15'}
      />
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Livre depois das contas fixas: {formatBRL(free)}
        </ThemedText>
        <ThemedText type="smallBold">
          {limitType === 'percent'
            ? `${parsed ?? 0}% = ${formatBRL(preview)} por ciclo`
            : free > 0
              ? `${formatBRL(preview)} = ${((preview / free) * 100).toFixed(1).replace('.', ',')}% do livre`
              : `${formatBRL(preview)} por ciclo`}
        </ThemedText>
        {limitType === 'percent' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Em %, o limite muda sozinho quando o salário ou as contas fixas mudam.
          </ThemedText>
        ) : null}
      </Card>

      <Button label="Salvar" onPress={save} disabled={!valid} />
      {existing ? <Button label="Excluir categoria" variant="danger" onPress={remove} /> : null}
    </FormScreen>
  );
}
