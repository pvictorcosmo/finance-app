import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { MonthCalendar } from '@/components/month-calendar';
import { ThemedText } from '@/components/themed-text';
import { Card, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { addDays, formatLong, parseISO, relativeDays, todayISO, type YM } from '@/domain/dates';
import type { ISODate } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/** Campo de data: atalhos (ontem/hoje/amanhã) + calendário que abre ao tocar. */
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ISODate;
  onChange: (date: ISODate) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<YM>(() => parseISO(value));
  const today = todayISO();

  const shortcuts: [string, ISODate][] = [
    ['Ontem', addDays(today, -1)],
    ['Hoje', today],
    ['Amanhã', addDays(today, 1)],
  ];

  return (
    <View style={styles.field}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <Pressable
        onPress={() => {
          setMonth(parseISO(value));
          setOpen((o) => !o);
        }}
        style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: open ? theme.primary : theme.border }]}>
        <ThemedText>{formatLong(value)}</ThemedText>
        <Row style={styles.trailing}>
          <ThemedText type="small" themeColor="textSecondary">
            {relativeDays(value, today)}
          </ThemedText>
          <Icon name="calendar" size={18} color={theme.accent} />
        </Row>
      </Pressable>
      <Row style={styles.shortcuts}>
        {shortcuts.map(([text, date]) => (
          <Pressable
            key={text}
            onPress={() => {
              onChange(date);
              setOpen(false);
            }}
            style={[
              styles.shortcut,
              date === value
                ? { backgroundColor: theme.primarySoft, borderColor: theme.primarySoft }
                : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <ThemedText type={date === value ? 'smallBold' : 'small'} style={date === value ? { color: theme.accent } : undefined}>
              {text}
            </ThemedText>
          </Pressable>
        ))}
      </Row>
      {open ? (
        <Card>
          <MonthCalendar
            month={month}
            onChangeMonth={setMonth}
            selected={value}
            onSelect={(d) => {
              onChange(d);
              setOpen(false);
            }}
          />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { textTransform: 'uppercase', letterSpacing: 0.6 },
  trailing: { gap: Spacing.two },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shortcuts: { marginTop: Spacing.one },
  shortcut: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 },
});
