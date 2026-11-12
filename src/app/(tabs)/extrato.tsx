import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ColumnChart } from '@/components/column-chart';
import { categoryIcon, Icon } from '@/components/icon';
import { MoneyText } from '@/components/money-text';
import { Appear } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  Fab,
  Field,
  ListItem,
  MultiChips,
  Row,
  Screen,
  SearchField,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { allCharges, type Charge } from '@/domain/charges';
import { addDays, formatLong, formatShort, todayISO } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { paymentLabel, paymentOptions } from '@/domain/payment';
import { EMPTY_FILTERS, PERIOD_LABELS, searchCharges, type PeriodPreset, type SearchFilters } from '@/domain/search';
import type { ISODate } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { useFinanceData } from '@/store/finance-store';
import { useMoney } from '@/store/ui-store';

/** Rows rendered at once; more appear with "Mostrar mais". */
const PAGE = 80;

/** "Hoje", "Ontem", "Agendado · 15/12" or "qua, 5 de novembro". */
function dayLabel(date: ISODate, today: ISODate): string {
  if (date === today) return 'Hoje';
  if (date === addDays(today, -1)) return 'Ontem';
  if (date > today) return `Agendado · ${formatShort(date)}`;
  return formatLong(date);
}

/**
 * Statement: every purchase (installments included) grouped by day, with search by
 * name/category/card and value expressions, filters, and a month-by-month chart of
 * whatever is being searched (e.g. "ração").
 */
export default function StatementScreen() {
  const theme = useTheme();
  const data = useFinanceData();
  const { money } = useMoney();
  const today = todayISO();
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>();

  // Opened from Home with a category/purchase: apply it once per navigation (`at` changes each time).
  const params = useLocalSearchParams<{ category?: string; q?: string; at?: string }>();
  const [appliedAt, setAppliedAt] = useState<string | undefined>();
  if (params.at && params.at !== appliedAt) {
    setAppliedAt(params.at);
    setFilters({
      ...EMPTY_FILTERS,
      query: params.q ?? '',
      categoryIds: params.category ? [params.category] : [],
    });
    setMinText('');
    setMaxText('');
    setVisible(PAGE);
    setSelectedMonth(undefined);
    setShowFilters(false);
  }

  const charges = useMemo(() => allCharges(data.expenses, data.cards), [data.expenses, data.cards]);
  const result = useMemo(() => searchCharges(data, charges, filters, today), [data, charges, filters, today]);
  const update = (patch: Partial<SearchFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setVisible(PAGE);
    setSelectedMonth(undefined);
  };

  const activeFilters =
    filters.categoryIds.length + filters.paymentKeys.length + (filters.minAmount !== undefined || filters.maxAmount !== undefined ? 1 : 0);
  const clearFilters = () => {
    setMinText('');
    setMaxText('');
    update({ categoryIds: [], paymentKeys: [], minAmount: undefined, maxAmount: undefined });
  };

  // Group the visible rows by day.
  const groups = useMemo(() => {
    const out: { date: ISODate; total: number; items: Charge[] }[] = [];
    for (const c of result.items.slice(0, visible)) {
      const last = out[out.length - 1];
      if (last && last.date === c.date) {
        last.items.push(c);
        last.total += c.amount;
      } else out.push({ date: c.date, total: c.amount, items: [c] });
    }
    return out;
  }, [result.items, visible]);

  const chartMonth = result.byMonth.find((m) => m.key === selectedMonth) ?? result.byMonth.at(-1);

  return (
    <Screen
      title="Extrato"
      subtitle="Todas as suas compras"
      fab={<Fab label="Gasto" onPress={() => router.push('/expense')} />}>
      <SearchField
        value={filters.query}
        onChangeText={(query) => update({ query })}
        placeholder="Buscar: ração, uber, acima de 100…"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => {
          const selected = filters.period === p;
          return (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => update({ period: p })}
              style={[
                styles.pill,
                selected
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}>
              <ThemedText type={selected ? 'smallBold' : 'small'} style={{ color: selected ? theme.onPrimary : theme.text }}>
                {PERIOD_LABELS[p]}
              </ThemedText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showFilters }}
          onPress={() => setShowFilters((s) => !s)}
          style={[
            styles.pill,
            activeFilters
              ? { backgroundColor: theme.primarySoft, borderColor: theme.primary }
              : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <Icon name="filter" size={16} color={activeFilters ? theme.accent : theme.text} />
          <ThemedText type="small" style={{ color: activeFilters ? theme.accent : theme.text }}>
            Filtros{activeFilters ? ` (${activeFilters})` : ''}
          </ThemedText>
        </Pressable>
      </ScrollView>

      {showFilters ? (
        <Card>
          <MultiChips
            label="Categorias"
            options={data.categories.map((c) => ({ value: c.id, label: c.name, color: c.color, icon: categoryIcon(c) }))}
            values={filters.categoryIds}
            onChange={(categoryIds) => update({ categoryIds })}
          />
          <MultiChips
            label="Pagamento"
            options={paymentOptions(data.cards)}
            values={filters.paymentKeys}
            onChange={(paymentKeys) => update({ paymentKeys })}
          />
          <Row style={styles.range}>
            <View style={styles.flex}>
              <Field
                label="Valor mínimo"
                value={minText}
                onChangeText={(t) => {
                  setMinText(t);
                  update({ minAmount: parseMoney(t) ?? undefined });
                }}
                keyboardType="decimal-pad"
                placeholder="0,00"
              />
            </View>
            <View style={styles.flex}>
              <Field
                label="Valor máximo"
                value={maxText}
                onChangeText={(t) => {
                  setMaxText(t);
                  update({ maxAmount: parseMoney(t) ?? undefined });
                }}
                keyboardType="decimal-pad"
                placeholder="sem limite"
              />
            </View>
          </Row>
          {activeFilters ? <Button label="Limpar filtros" variant="ghost" compact onPress={clearFilters} /> : null}
        </Card>
      ) : null}

      <Card>
        <ThemedText type="caption" themeColor="textSecondary">
          {result.filtered ? 'TOTAL ENCONTRADO' : `TOTAL · ${PERIOD_LABELS[filters.period].toUpperCase()}`}
        </ThemedText>
        <MoneyText value={result.total} />
        <ThemedText type="caption" themeColor="textSecondary">
          {result.count} {result.count === 1 ? 'compra' : 'compras'}
          {result.count ? ` · média de ${money(result.average)}` : ''}
        </ThemedText>

        {result.byMonth.length >= 2 && result.count > 0 ? (
          <View style={styles.chart}>
            <ColumnChart
              data={result.byMonth.map((m) => ({ key: m.key, label: m.label, value: m.total }))}
              color={theme.primary}
              selectedKey={chartMonth?.key}
              onSelect={setSelectedMonth}
              valueLabel={result.filtered && filters.query ? `Gasto com "${filters.query.trim()}" por mês` : 'Gasto por mês'}
            />
            {chartMonth ? (
              <ThemedText type="caption" themeColor="textSecondary">
                {chartMonth.label}: {money(chartMonth.total)}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {result.filtered && result.topMerchants.length > 1 ? (
          <View style={styles.top}>
            <ThemedText type="caption" themeColor="textSecondary">
              ONDE VOCÊ MAIS GASTOU
            </ThemedText>
            {result.topMerchants.map((m) => (
              <Row key={m.name} style={styles.between}>
                <ThemedText type="small" numberOfLines={1} style={styles.flex}>
                  {m.name} <ThemedText type="caption" themeColor="textSecondary">× {m.count}</ThemedText>
                </ThemedText>
                <ThemedText type="smallBold">{money(m.total)}</ThemedText>
              </Row>
            ))}
          </View>
        ) : null}
      </Card>

      {result.count === 0 ? (
        <EmptyState
          icon="search"
          title={result.filtered ? 'Nada por aqui' : 'Nenhuma compra ainda'}
          text={
            result.filtered
              ? 'Nenhuma compra combina com essa busca. Tente outro termo, período ou filtro.'
              : 'Quando você lançar gastos, eles aparecem aqui, organizados por dia.'
          }
        />
      ) : (
        groups.map((g, i) => (
          <Appear key={g.date} index={i} style={styles.group}>
            <Row style={styles.dayHeader}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {dayLabel(g.date, today)}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {money(g.total)}
              </ThemedText>
            </Row>
            <Card>
              {g.items.map((c, i) => {
                const cat = data.categories.find((x) => x.id === c.categoryId);
                return (
                  <Fragment key={c.id}>
                    {i > 0 ? <Divider /> : null}
                    <ListItem
                      icon={cat ? categoryIcon(cat) : 'tag'}
                      color={cat?.color ?? theme.textSecondary}
                      title={c.description}
                      subtitle={`${cat?.name ?? 'Sem categoria'} · ${paymentLabel(c.payment, data.cards)}`}
                      right={money(c.amount)}
                      onPress={() => router.push({ pathname: '/expense', params: { id: c.expenseId } })}
                    />
                  </Fragment>
                );
              })}
            </Card>
          </Appear>
        ))
      )}

      {result.items.length > visible ? (
        <Button
          label={`Mostrar mais (${result.items.length - visible})`}
          variant="secondary"
          onPress={() => setVisible((v) => v + PAGE)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  pills: { gap: Spacing.two, paddingVertical: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
  },
  range: { gap: Spacing.two, alignItems: 'flex-start' },
  chart: { marginTop: Spacing.two, gap: Spacing.one },
  top: { marginTop: Spacing.two, gap: 6 },
  group: { gap: Spacing.two },
  dayHeader: { justifyContent: 'space-between', paddingHorizontal: Spacing.one },
});
