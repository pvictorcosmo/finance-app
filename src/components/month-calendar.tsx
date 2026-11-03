import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { addMonths, daysInMonth, MONTHS, todayISO, toISO, weekday, WEEKDAYS_SHORT, type YM } from '@/domain/dates';
import type { ISODate } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export type DayMarkers = Record<ISODate, string[]>;

/** Calendário mensal com pontinhos coloridos nos dias que têm algo. */
export function MonthCalendar({
  month,
  onChangeMonth,
  selected,
  onSelect,
  markers = {},
}: {
  month: YM;
  onChangeMonth: (month: YM) => void;
  selected?: ISODate;
  onSelect: (date: ISODate) => void;
  markers?: DayMarkers;
}) {
  const theme = useTheme();
  const today = todayISO();
  const first = toISO({ y: month.y, m: month.m, d: 1 });
  const lead = weekday(first);
  const total = daysInMonth(month.y, month.m);
  const cells: (ISODate | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: total }, (_, i) => toISO({ y: month.y, m: month.m, d: i + 1 })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={styles.wrap}>
      <Row style={styles.header}>
        <Pressable
          accessibilityLabel="Mês anterior"
          hitSlop={12}
          onPress={() => onChangeMonth(addMonths(month, -1))}
          style={styles.nav}>
          <ThemedText type="subtitle">‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">
          {MONTHS[month.m - 1]} {month.y}
        </ThemedText>
        <Pressable
          accessibilityLabel="Próximo mês"
          hitSlop={12}
          onPress={() => onChangeMonth(addMonths(month, 1))}
          style={styles.nav}>
          <ThemedText type="subtitle">›</ThemedText>
        </Pressable>
      </Row>

      <View style={styles.grid}>
        {WEEKDAYS_SHORT.map((w, i) => (
          <View key={`w${i}`} style={styles.cell}>
            <ThemedText type="small" themeColor="textSecondary">
              {w}
            </ThemedText>
          </View>
        ))}
        {cells.map((date, i) => {
          if (!date) return <View key={`e${i}`} style={styles.cell} />;
          const isSelected = date === selected;
          const isToday = date === today;
          const dots = markers[date] ?? [];
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(date)}
              style={styles.cell}>
              <View
                style={[
                  styles.day,
                  isSelected && { backgroundColor: theme.primary },
                  !isSelected && isToday && { borderWidth: 1.5, borderColor: theme.primary },
                ]}>
                <ThemedText
                  type={isToday || isSelected ? 'smallBold' : 'small'}
                  style={isSelected ? { color: theme.onPrimary } : undefined}>
                  {Number(date.slice(8))}
                </ThemedText>
              </View>
              <View style={styles.dots}>
                {dots.slice(0, 3).map((c, j) => (
                  <View key={j} style={[styles.dot, { backgroundColor: c }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  header: { justifyContent: 'space-between' },
  nav: { paddingHorizontal: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2, minHeight: 48 },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 2, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
