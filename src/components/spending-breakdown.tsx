import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { categoryIcon, Icon, IconBadge, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Row } from '@/components/ui';
import { useSeriesColor } from '@/constants/series-colors';
import { Spacing } from '@/constants/theme';
import {
  categoryBreakdown,
  changeRatio,
  chargesOfSlice,
  topMerchants,
  UNCATEGORIZED,
  type CategorySlice,
} from '@/domain/breakdown';
import { computeBudget } from '@/domain/budget';
import { budgetDate, type Charge } from '@/domain/charges';
import { elapsedDays, shiftCycle, type Cycle } from '@/domain/cycle';
import { addDays } from '@/domain/dates';
import type { Cents, FinanceData, ID, ISODate } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { useMoney } from '@/store/ui-store';

/** One horizontal bar: label, value, caption and a bar sized against the largest row. */
interface BarRow {
  key: string;
  label: string;
  value: Cents;
  caption: string;
  color: string;
  icon?: IconName;
  onPress?: () => void;
  accessibilityHint?: string;
}

/**
 * Opens the Extrato tab filtered by a category and/or search text. `at` makes each
 * navigation distinct so the statement re-applies the filter even when already open.
 */
export function openStatement(params: { category?: ID; q?: string }): void {
  router.navigate({ pathname: '/extrato', params: { ...params, at: String(Date.now()) } });
}

const pct = (ratio: number) => `${Math.round(ratio * 100)}%`;

/** "▲ 12% a mais que no ciclo anterior" (or "até o mesmo dia" while the cycle runs). */
function comparisonText(current: Cents, previous: Cents, sameDay: boolean): string | null {
  const ratio = changeRatio(current, previous);
  if (ratio === null) return null;
  const when = sameDay ? 'que no ciclo anterior até hoje' : 'que no ciclo anterior';
  if (ratio === 0) return sameDay ? 'Igual ao ciclo anterior até hoje' : 'Igual ao ciclo anterior';
  return `${ratio > 0 ? '▲' : '▼'} ${pct(Math.abs(ratio))} ${ratio > 0 ? 'a mais' : 'a menos'} ${when}`;
}

/**
 * "Para onde foi seu dinheiro": spending per category as ranked bars; tapping a
 * category shows what was spent most inside it (e.g. Dia a dia → Mercado, Padaria).
 * @param data App data.
 * @param cycle Cycle being shown.
 * @param charges The cycle's charges (as counted by the budget).
 * @param today Reference date.
 * @param isCurrent Whether `cycle` is the running one (compares to the same day of the previous cycle).
 */
export function SpendingBreakdown({
  data,
  cycle,
  charges,
  today,
  isCurrent,
}: {
  data: FinanceData;
  cycle: Cycle;
  charges: Charge[];
  today: ISODate;
  isCurrent: boolean;
}) {
  const theme = useTheme();
  const { money } = useMoney();
  const [selected, setSelected] = useState<ID | null>(null);

  // Previous cycle, cut at the same day while the current one is still running.
  const previous = useMemo(() => {
    const prev = shiftCycle(cycle, data.settings.cycleStartDay, -1);
    const all = computeBudget(data, prev, today).charges;
    if (!isCurrent) return all;
    const limit = addDays(prev.start, elapsedDays(cycle, today) - 1);
    const basis = data.settings.cardBudgetBasis ?? 'due';
    return all.filter((c) => budgetDate(c, basis) <= limit);
  }, [data, cycle, today, isCurrent]);

  const breakdown = useMemo(
    () => categoryBreakdown(charges, previous, data.categories),
    [charges, previous, data.categories],
  );
  const slice = breakdown.slices.find((s) => s.id === selected);

  if (!breakdown.slices.length) return null;

  const colorOf = (s: CategorySlice) => s.color ?? theme.textSecondary;

  let rows: BarRow[];
  let total: Cents;
  let previousTotal: Cents;
  let others: BarRow | undefined;
  if (slice) {
    const items = chargesOfSlice(charges, slice.id, data.categories);
    const top = topMerchants(items, 5);
    const toRow = (m: { name: string; total: Cents; count: number }, i: number, folded = false): BarRow => ({
      key: `${m.name}-${i}`,
      label: m.name,
      value: m.total,
      caption: `${m.count}× · ${pct(slice.total ? m.total / slice.total : 0)}`,
      color: colorOf(slice),
      onPress: folded
        ? undefined
        : () => openStatement({ q: m.name, category: slice.id === UNCATEGORIZED ? undefined : slice.id }),
      accessibilityHint: folded ? undefined : 'Abre as compras no extrato',
    });
    rows = top.rows.map((m, i) => toRow(m, i));
    others = top.others ? toRow(top.others, rows.length, true) : undefined;
    total = slice.total;
    previousTotal = slice.previous;
  } else {
    rows = breakdown.slices.map((s) => ({
      key: s.id,
      label: s.name,
      value: s.total,
      caption: `${pct(s.share)} · ${s.count} ${s.count === 1 ? 'compra' : 'compras'}`,
      color: colorOf(s),
      icon: s.category ? categoryIcon(s.category) : 'tag',
      onPress: () => setSelected(s.id),
      accessibilityHint: 'Mostra onde você mais gastou nesta categoria',
    }));
    total = breakdown.total;
    previousTotal = breakdown.previousTotal;
  }
  const max = Math.max(...rows.map((r) => r.value), others?.value ?? 0, 1);
  const comparison = comparisonText(total, previousTotal, isCurrent);

  return (
    <Card>
      <ThemedText type="caption" themeColor="textSecondary">
        {slice ? `ONDE VOCÊ MAIS GASTA EM ${slice.name.toUpperCase()}` : 'PARA ONDE FOI SEU DINHEIRO'}
      </ThemedText>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        <Pill label="Todas" selected={!slice} onPress={() => setSelected(null)} />
        {breakdown.slices.map((s) => (
          <Pill
            key={s.id}
            label={s.name}
            color={colorOf(s)}
            selected={s.id === slice?.id}
            onPress={() => setSelected(s.id)}
          />
        ))}
      </ScrollView>

      <View>
        <ThemedText type="amount">{money(total)}</ThemedText>
        {comparison ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {comparison}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.rows}>
        {rows.map((r) => (
          <Bar key={r.key} row={r} max={max} />
        ))}
        {others ? <Bar row={{ ...others, color: theme.textSecondary }} max={max} /> : null}
      </View>

      {slice ? (
        <Button
          label={`Ver ${slice.name} no extrato`}
          icon="list"
          variant="ghost"
          compact
          onPress={() => openStatement({ category: slice.id === UNCATEGORIZED ? undefined : slice.id })}
        />
      ) : (
        <ThemedText type="caption" themeColor="textSecondary">
          Toque numa categoria para ver onde você mais gasta nela.
        </ThemedText>
      )}
    </Card>
  );
}

/** Category filter pill with an optional color dot. */
function Pill({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const series = useSeriesColor();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.pill,
        selected
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : { backgroundColor: theme.background, borderColor: theme.border },
      ]}>
      {color ? <View style={[styles.dot, { backgroundColor: series(color) }]} /> : null}
      <ThemedText type={selected ? 'smallBold' : 'small'} style={{ color: selected ? theme.onPrimary : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** A ranked bar row; text stays in text colors, the bar carries the category color. */
function Bar({ row, max }: { row: BarRow; max: number }) {
  const theme = useTheme();
  const series = useSeriesColor();
  const { money } = useMoney();
  const ratio = Math.max(0, Math.min(1, row.value / max));
  const content = (
    <Row style={styles.barRow}>
      {row.icon ? <IconBadge name={row.icon} color={row.color} size={36} /> : null}
      <View style={styles.flex}>
        <Row style={styles.between}>
          <ThemedText type="small" numberOfLines={1} style={styles.flex}>
            {row.label}
          </ThemedText>
          <ThemedText type="smallBold">{money(row.value)}</ThemedText>
        </Row>
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: series(row.color) }]} />
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {row.caption}
        </ThemedText>
      </View>
      {row.onPress ? <Icon name="chevronRight" size={18} color={theme.textSecondary} /> : null}
    </Row>
  );
  if (!row.onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.label}: ${money(row.value)}, ${row.caption}`}
      accessibilityHint={row.accessibilityHint}
      onPress={row.onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { justifyContent: 'space-between', gap: Spacing.two },
  pressed: { opacity: 0.6 },
  pills: { gap: Spacing.two, paddingVertical: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rows: { gap: Spacing.three },
  barRow: { gap: Spacing.two, alignItems: 'center' },
  track: { height: 8, borderRadius: 4, marginVertical: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
