import { router, Stack } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AiError, categorizeWithAi, DEFAULT_AI_MODEL } from '@/ai/claude';
import { useHasApiKey } from '@/ai/key-store';
import { categoryIcon, Icon, IconBadge } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, Checkbox, Chips, Divider, EmptyState, FormScreen, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatShort } from '@/domain/dates';
import { buildImportRows, defaultImportPayment, setRowCategory, type ImportRow } from '@/domain/import-plan';
import { formatBRL } from '@/domain/money';
import { keyToPayment, paymentOptions } from '@/domain/payment';
import { parseStatement, splitExpenses, type ParsedStatement } from '@/domain/statement';
import { buildHistoryIndex } from '@/domain/suggestions';
import { useTheme } from '@/hooks/use-theme';
import { pickStatementFile } from '@/import/pick-statement';
import { useFinance, useFinanceData } from '@/store/finance-store';

type Step = 'pick' | 'review' | 'done';

const SOURCE_LABEL: Record<NonNullable<ImportRow['categorySource']>, string> = {
  history: 'histórico',
  keyword: 'palavra-chave',
  ai: 'IA',
  manual: 'você',
};

/**
 * Imports a bank statement or credit card bill (CSV/OFX from Nubank, Itaú, Inter, BB...).
 * Lines are categorized by history and keywords, optionally by Claude, and reviewed before saving.
 */
export default function ImportScreen() {
  const theme = useTheme();
  const data = useFinanceData();
  const addExpenses = useFinance((s) => s.addExpenses);
  const hasKey = useHasApiKey();
  const index = useMemo(() => buildHistoryIndex(data.expenses), [data.expenses]);

  const [step, setStep] = useState<Step>('pick');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [paymentKey, setPaymentKey] = useState<string>('debit');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pick' | 'ai' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const pick = async () => {
    setBusy('pick');
    setMessage(null);
    try {
      const file = await pickStatementFile();
      if (!file) return;
      const statement = parseStatement(file.text);
      const { expenses, ignored } = splitExpenses(statement.rows);
      if (!expenses.length) {
        setMessage(
          statement.rows.length
            ? 'Não encontrei gastos neste arquivo (só entradas ou saldos).'
            : 'Não consegui ler este arquivo. Exporte o extrato em CSV ou OFX pelo app/site do banco.',
        );
        return;
      }
      setFileName(file.name);
      setParsed(statement);
      setIgnoredCount(ignored.length);
      setRows(buildImportRows(expenses, data.expenses, data.categories, index));
      setPaymentKey(defaultImportPayment(statement, data.cards));
      setStep('review');
    } catch {
      setMessage('Erro ao abrir o arquivo.');
    } finally {
      setBusy(null);
    }
  };

  const uncategorized = rows.filter((r) => r.include && !r.categoryId);
  const included = rows.filter((r) => r.include);
  const duplicates = rows.filter((r) => r.duplicate).length;
  const total = included.reduce((s, r) => s + r.value, 0);

  const categorizeAi = async () => {
    const targets = rows.filter((r) => r.categorySource !== 'manual' && r.categorySource !== 'history');
    if (!targets.length) return;
    setBusy('ai');
    setMessage(null);
    try {
      const result = await categorizeWithAi(
        targets.map((r) => ({ id: r.key, description: r.originalDescription, amount: r.value })),
        { model: data.settings.aiModel ?? DEFAULT_AI_MODEL, categories: data.categories },
      );
      setRows((list) =>
        list.map((r) => {
          const s = result.get(r.key);
          if (!s) return r;
          return {
            ...r,
            description: s.cleanDescription || r.description,
            categoryId: s.categoryId ?? r.categoryId,
            categorySource: s.categoryId ? 'ai' : r.categorySource,
          };
        }),
      );
    } catch (error) {
      setMessage(error instanceof AiError ? error.message : 'Erro ao categorizar com a IA.');
    } finally {
      setBusy(null);
    }
  };

  const doImport = () => {
    const payment = keyToPayment(paymentKey);
    const ready = included.filter((r) => r.categoryId);
    addExpenses(
      ready.map((r) => ({
        description: r.description,
        amount: r.value,
        date: r.date,
        categoryId: r.categoryId!,
        payment,
        installments: 1, // installments in a bill are already split by the bank
        externalId: r.externalId,
      })),
    );
    setImportedCount(ready.length);
    setStep('done');
  };

  if (step === 'done') {
    return (
      <FormScreen>
        <Stack.Screen options={{ title: 'Importar extrato' }} />
        <EmptyState
          icon="check"
          text={`${importedCount} gasto(s) importado(s) de ${fileName}.`}
          action={
            <Row style={styles.wrap}>
              <Button label="Ver resumo" onPress={() => router.navigate('/')} />
              <Button label="Importar outro" variant="secondary" onPress={() => setStep('pick')} />
            </Row>
          }
        />
      </FormScreen>
    );
  }

  if (step === 'pick') {
    return (
      <FormScreen>
        <Stack.Screen options={{ title: 'Importar extrato' }} />
        <Card>
          <Row>
            <IconBadge name="download" color={theme.primary} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">Extrato da conta ou fatura do cartão</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Arquivos CSV ou OFX do Nubank, Itaú, Inter, Banco do Brasil e outros bancos.
              </ThemedText>
            </View>
          </Row>
          <ThemedText type="small" themeColor="textSecondary">
            1. No app ou site do banco, exporte o extrato/fatura em CSV ou OFX.{'\n'}
            2. Salve no celular (ou envie para você no WhatsApp/e-mail e baixe).{'\n'}
            3. Escolha o arquivo aqui. Você revisa tudo antes de importar.
          </ThemedText>
          <Button label={busy === 'pick' ? 'Abrindo…' : 'Escolher arquivo'} icon="download" onPress={pick} disabled={busy !== null} />
          {message ? (
            <ThemedText type="caption" style={{ color: theme.danger }}>
              ! {message}
            </ThemedText>
          ) : null}
        </Card>
        <Card>
          <ThemedText type="smallBold">Onde encontrar no seu banco</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            • Nubank: fatura → ••• → Exportar fatura (CSV); conta → Extrato → Exportar.{'\n'}
            • Itaú: Extrato → Salvar/Exportar → OFX ou CSV (pelo site/app).{'\n'}
            • Inter: Extrato → Exportar → CSV ou OFX.{'\n'}
            • BB: Extrato → Salvar → CSV ou OFX (Money).
          </ThemedText>
        </Card>
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <Stack.Screen options={{ title: 'Revisar importação' }} />
      <Card>
        <ThemedText type="smallBold" numberOfLines={1}>
          {fileName}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {parsed?.bank ? `${parsed.bank} · ` : ''}
          {parsed?.format.toUpperCase()} · {rows.length} gasto(s) encontrados
          {ignoredCount ? ` · ${ignoredCount} entradas/saldos/pagamentos ignorados` : ''}
          {duplicates ? ` · ${duplicates} já lançado(s)` : ''}
        </ThemedText>
      </Card>

      <Chips
        label="Esses gastos foram pagos com"
        options={paymentOptions(data.cards)}
        value={paymentKey}
        onChange={setPaymentKey}
      />

      {hasKey ? (
        <Button
          label={busy === 'ai' ? 'Categorizando com IA…' : `Categorizar com IA${uncategorized.length ? ` (${uncategorized.length} sem categoria)` : ''}`}
          icon="sparkles"
          variant="secondary"
          onPress={categorizeAi}
          disabled={busy !== null}
        />
      ) : (
        <Pressable onPress={() => router.navigate('/plan')}>
          <ThemedText type="caption" style={{ color: theme.accent }}>
            ✨ Configure sua chave do Claude em Planejar para a IA categorizar e limpar os nomes automaticamente.
          </ThemedText>
        </Pressable>
      )}
      {message ? (
        <ThemedText type="caption" style={{ color: theme.danger }}>
          ! {message}
        </ThemedText>
      ) : null}

      <Card>
        {rows.map((r, i) => {
          const category = data.categories.find((c) => c.id === r.categoryId);
          const open = expanded === r.key;
          return (
            <Fragment key={r.key}>
              {i > 0 ? <Divider /> : null}
              <Row style={[styles.row, !r.include && styles.excluded]}>
                <Checkbox
                  checked={r.include}
                  label={`Importar ${r.description}`}
                  onPress={() => setRows((list) => list.map((x) => (x.key === r.key ? { ...x, include: !x.include } : x)))}
                />
                <Pressable style={styles.flex} onPress={() => setExpanded(open ? null : r.key)}>
                  <ThemedText type="small" numberOfLines={1}>
                    {r.description}
                  </ThemedText>
                  <Row style={styles.meta}>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {formatShort(r.date)}
                    </ThemedText>
                    {category ? (
                      <Row style={styles.catTag}>
                        <Icon name={categoryIcon(category)} size={12} color={theme.textSecondary} />
                        <ThemedText type="caption" themeColor="textSecondary">
                          {category.name}
                          {r.categorySource ? ` · ${SOURCE_LABEL[r.categorySource]}` : ''}
                        </ThemedText>
                      </Row>
                    ) : (
                      <ThemedText type="caption" style={{ color: theme.warning }}>
                        ! escolher categoria
                      </ThemedText>
                    )}
                    {r.duplicate ? <Badge tone="neutral" label="já lançado" /> : null}
                  </Row>
                </Pressable>
                <ThemedText type="smallBold">{formatBRL(r.value)}</ThemedText>
              </Row>
              {open ? (
                <View style={styles.picker}>
                  <Chips
                    options={data.categories.map((c) => ({ value: c.id, label: c.name, color: c.color, icon: categoryIcon(c) }))}
                    value={r.categoryId}
                    onChange={(id) => {
                      setRows((list) => setRowCategory(list, r.key, id));
                      setExpanded(null);
                    }}
                  />
                  {r.originalDescription !== r.description ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      No banco: {r.originalDescription}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}
            </Fragment>
          );
        })}
      </Card>

      {uncategorized.length ? (
        <ThemedText type="caption" style={{ color: theme.warning }}>
          ! {uncategorized.length} lançamento(s) marcado(s) sem categoria: toque neles para escolher ou desmarque.
        </ThemedText>
      ) : null}
      <Button
        label={`Importar ${included.length} gasto(s) · ${formatBRL(total)}`}
        icon="check"
        onPress={doImport}
        disabled={!included.length || uncategorized.length > 0}
      />
      <Button label="Escolher outro arquivo" variant="ghost" onPress={() => setStep('pick')} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexWrap: 'wrap', justifyContent: 'center' },
  row: { paddingVertical: Spacing.two, gap: Spacing.three },
  excluded: { opacity: 0.45 },
  meta: { gap: Spacing.two, flexWrap: 'wrap', marginTop: 2 },
  catTag: { gap: 4 },
  picker: { paddingLeft: 40, paddingBottom: Spacing.two, gap: Spacing.one },
});
