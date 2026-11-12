import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Cents } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | 'back';

/** Largest amount the keypad accepts: R$ 99.999.999,99. */
export const KEYPAD_MAX: Cents = 9_999_999_999;

/**
 * Cash-register entry: digits come in from the right, as cents.
 * 1 → 0,01 · 2 → 0,12 · 3 → 1,23 · "00" → 123,00 · back → 12,30.
 * @param cents Current amount.
 * @param key Key pressed.
 * @returns New amount (unchanged when it would exceed {@link KEYPAD_MAX}).
 */
export function applyKey(cents: Cents, key: KeypadKey): Cents {
  if (key === 'back') return Math.floor(cents / 10);
  const next = key === '00' ? cents * 100 : cents * 10 + Number(key);
  return next > KEYPAD_MAX ? cents : next;
}

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['00', '0', 'back'],
];

/**
 * Big numeric keypad for typing an amount without the system keyboard.
 * @param value Amount in cents.
 * @param onChange Receives the new amount.
 */
export function AmountKeypad({ value, onChange }: { value: Cents; onChange: (cents: Cents) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {ROWS.map((row) => (
        <View key={row.join('')} style={styles.row}>
          {row.map((key) => (
            <PressableScale
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === 'back' ? 'Apagar' : key}
              onPress={() => onChange(applyKey(value, key))}
              onLongPress={key === 'back' ? () => onChange(0) : undefined}
              scaleTo={0.92}
              feedback="selection"
              style={[styles.key, { backgroundColor: theme.backgroundElement }]}>
              {key === 'back' ? (
                <Icon name="backspace" size={24} color={theme.text} />
              ) : (
                <ThemedText style={styles.digit}>{key}</ThemedText>
              )}
            </PressableScale>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  key: { flex: 1, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 24, lineHeight: 30, fontWeight: 600, fontVariant: ['tabular-nums'] },
});
