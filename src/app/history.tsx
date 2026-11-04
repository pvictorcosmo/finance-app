import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ColumnChart, type ColumnDatum } from '@/components/column-chart';
import { HeroCard, HeroText } from '@/components/hero-card';
import { ThemedText } from '@/components/themed-text';
import { Card, Chips, EmptyState, FormScreen, KeyValue, Row, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatMonthYear, formatShort, todayISO } from '@/domain/dates';
import { cycleHistory, savingsTotal, type CycleSummary } from '@/domain/history';
import { formatBRL } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';
import { useFinanceData } from '@/store/finance-store';

/** Quantos ciclos aparecem nos gráficos. */
const VISIBLE = 6;
const ALL = '__all__';

export default function HistoryScreen() {
  const theme = useTheme();
  const data = useFinanceData();
  const today = todayISO();

  const history = useMemo(() => cycleHistory(data, today), [data, today]);
  const visible = history.slice(-VISIBLE);
  const total = savingsTotal(history);

  const [categoryKey, setCategoryKey] = useState<string>(ALL);
  const [selected, setSelected] = useState<string | undefined>(() => visible.at(-1)?.cycle.start);

  const category = data.categories.find((c) => c.id === categoryKey);
  const chartData: ColumnDatum[] = visible.map((h) => {
    const cat = category ? h.budget.categories.find((c) => c.category.id === category.id) : undefined;
    return {
      key: h.cycle.start,
      label: formatMonthYear(h.cycle.start).slice(0, 3),
      value: category ? (cat?.spent ?? 0) : h.budget.spent,
      target: category ? cat?.limit : h.budget.free,
      partial: !h.closed,
    };
  });
  const selectedSummary = visible.find((h) => h.cycle.start === selected) ?? visible.at(-1);

  return (
    <FormScreen>
      <HeroCard>
        <HeroText type="caption" dim>
          POUPANÇA ACUMULADA
        </HeroText>
        <HeroText type="title">{formatBRL(total)}</HeroText>
        <HeroText dim>
          Soma do que sobrou em cada ciclo fechado + rendas que foram direto para a poupança. Gastar mais que o
          livre num ciclo tira da poupança.
        </HeroText>
      </HeroCard>

      {history.length < 2 ? (
        <EmptyState text="Os gráficos de comparação aparecem depois que o primeiro ciclo fechar. Por enquanto, este é seu primeiro ciclo." />
      ) : null}

      <SectionHeader title="Gastos por ciclo" />
      <Card>
        <Chips
          options={[
            { value: ALL, label: 'Todos' },
            ...data.categories.map((c) => ({ value: c.id, label: c.name, color: c.color })),
          ]}
          value={categoryKey}
          onChange={setCategoryKey}
        />
        <ColumnChart
          data={chartData}
          color={category?.color ?? theme.primary}
          selectedKey={selectedSummary?.cycle.start}
          onSelect={setSelected}
          valueLabel={category ? `Gasto em ${category.name}` : 'Gasto total'}
          targetLabel={category ? 'Limite' : 'Livre do ciclo'}
        />
        {selectedSummary ? <CycleDetail summary={selectedSummary} categoryId={category?.id} /> : null}
        <ThemedText type="small" themeColor="textSecondary">
          Toque numa coluna para ver os detalhes. A coluna mais clara é o ciclo em andamento.
        </ThemedText>
      </Card>

      <SectionHeader title="Tabela de ciclos" />
      <Card>
        <Row style={[styles.tableRow, { borderBottomColor: theme.border }]}>
          <ThemedText type="smallBold" style={styles.colCycle}>
            Ciclo
          </ThemedText>
          <ThemedText type="smallBold" style={styles.colNum}>
            Livre
          </ThemedText>
          <ThemedText type="smallBold" style={styles.colNum}>
            Gasto
          </ThemedText>
          <ThemedText type="smallBold" style={styles.colNum}>
            Poupou
          </ThemedText>
        </Row>
        {[...history].reverse().map((h) => (
          <Row key={h.cycle.start} style={[styles.tableRow, { borderBottomColor: theme.border }]}>
            <View style={styles.colCycle}>
              <ThemedText type="small">{formatMonthYear(h.cycle.start)}</ThemedText>
              {!h.closed ? (
                <ThemedText type="small" themeColor="textSecondary">
                  atual
                </ThemedText>
              ) : null}
            </View>
            <ThemedText type="caption" style={styles.colNum} numberOfLines={1}>
              {formatBRL(h.budget.free)}
            </ThemedText>
            <ThemedText type="caption" style={styles.colNum} numberOfLines={1}>
              {formatBRL(h.budget.spent)}
            </ThemedText>
            <ThemedText
              type="caption"
              numberOfLines={1}
              style={[styles.colNum, { fontWeight: 700, color: h.saved < 0 ? theme.danger : theme.success }]}>
              {h.closed || h.saved ? formatBRL(h.saved) : '—'}
            </ThemedText>
          </Row>
        ))}
      </Card>
    </FormScreen>
  );
}

function CycleDetail({ summary, categoryId }: { summary: CycleSummary; categoryId?: string }) {
  const theme = useTheme();
  const { budget, cycle, closed } = summary;
  const cat = categoryId ? budget.categories.find((c) => c.category.id === categoryId) : undefined;

  return (
    <View style={[styles.detail, { borderTopColor: theme.border }]}>
      <ThemedText type="smallBold">
        {formatShort(cycle.start)} – {formatShort(cycle.end)} {closed ? '' : '(em andamento)'}
      </ThemedText>
      {cat ? (
        <>
          <KeyValue label="Gasto" value={formatBRL(cat.spent)} />
          <KeyValue label="Limite" value={formatBRL(cat.limit)} />
          <KeyValue
            label={cat.remaining >= 0 ? 'Sobrou' : 'Estourou'}
            value={formatBRL(Math.abs(cat.remaining))}
            color={cat.remaining >= 0 ? theme.success : theme.danger}
          />
        </>
      ) : (
        <>
          <KeyValue label="Renda (salário + extras)" value={formatBRL(budget.salary + budget.extraIncome)} />
          <KeyValue label="Contas fixas" value={`− ${formatBRL(budget.fixed)}`} />
          <KeyValue label="Gasto nas categorias" value={formatBRL(budget.spent)} />
          <KeyValue
            label={closed ? 'Foi para a poupança' : 'Deve sobrar (até agora)'}
            value={formatBRL(closed ? summary.saved : budget.leftover)}
            strong
            color={(closed ? summary.saved : budget.leftover) >= 0 ? theme.success : theme.danger}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, gap: Spacing.one },
  tableRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.two, alignItems: 'flex-start' },
  colCycle: { flex: 0.8 },
  colNum: { flex: 1.1, textAlign: 'right' },
});
