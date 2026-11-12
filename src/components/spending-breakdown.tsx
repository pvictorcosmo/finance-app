import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { categoryIcon, Icon, IconBadge, type IconName } from '@/components/icon';
import { MoneyText } from '@/components/money-text';
import { AnimatedFill, Appear } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Row } from '@/components/ui';
import { useSeriesColor } from '@/constants/series-colors';
import { Spacing } from '@/constants/theme';
import {
  changeRatio,
  chargesOfSlice,
  topMerchants,
  UNCATEGORIZED,
  type Breakdown,
  type CategorySlice,
} from '@/domain/breakdown';
import type { Charge } from '@/domain/charges';
import type { Cents, FinanceData, ID } from '@/domain/types';
import { haptic } from '@/ui/haptics';
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
 * @param charges The cycle's charges (as counted by the budget).
 * @param breakdown {@link categoryBreakdown} of `charges` against the previous cycle.
 * @param isCurrent Whether the cycle is the running one (the comparison is "até hoje").
 */
export function SpendingBreakdown({
  data,
  charges,
  breakdown,
  isCurrent,
}: {
  data: FinanceData;
  charges: Charge[];
  breakdown: Breakdown;
  isCurrent: boolean;
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<ID | null>(null);
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
      onPress: () => {
        haptic.selection();
        setSelected(s.id);
      },
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
        <MoneyText value={total} />
        {comparison ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {comparison}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.rows}>
        {/* Keyed by the selection so the rows slide in again when switching category. */}
        {rows.map((r, i) => (
          <Appear key={`${slice?.id ?? 'all'}-${r.key}`} index={i}>
            <Bar row={r} max={max} />
          </Appear>
        ))}
        {others ? (
          <Appear key={`${slice?.id ?? 'all'}-others`} index={rows.length}>
            <Bar row={{ ...others, color: theme.textSecondary }} max={max} />
          </Appear>
        ) : null}
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
      onPress={() => {
        if (!selected) haptic.selection();
        onPress();
      }}
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
          <AnimatedFill ratio={ratio} color={row.color} height={8} />
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
});
