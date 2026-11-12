import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { useCountUp } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import type { ThemeColor } from '@/constants/theme';
import { formatBRL } from '@/domain/money';
import type { Cents } from '@/domain/types';
import { HIDDEN_VALUE, useUiStore } from '@/store/ui-store';

/** "R$ 1.234,56" -> ["R$ 1.234", ",56"]; values without cents stay whole. */
export function splitCents(formatted: string): [string, string] {
  const i = formatted.lastIndexOf(',');
  return i < 0 ? [formatted, ''] : [formatted.slice(0, i), formatted.slice(i)];
}

const SIZES = {
  /** Hero numbers (money left in the month, card bill). */
  hero: { whole: 40, cents: 22, line: 46 },
  /** Totals inside cards. */
  large: { whole: 26, cents: 16, line: 32 },
} as const;

/**
 * Amount with the cents smaller than the reais ("R$ 1.234" + ",56"), tabular digits,
 * hidden as "R$ ••••" when the user hides values.
 * @param value Amount in cents.
 * @param size `hero` or `large`.
 * @param animate Counts up to the value when it changes.
 * @param reveal Always shows the value, even with values hidden (e.g. while typing it).
 */
export function MoneyText({
  value,
  size = 'large',
  animate,
  reveal,
  style,
  themeColor,
}: {
  value: Cents;
  size?: keyof typeof SIZES;
  animate?: boolean;
  reveal?: boolean;
  style?: StyleProp<TextStyle>;
  themeColor?: ThemeColor;
}) {
  const hidden = useUiStore((s) => s.hideValues) && !reveal;
  const counted = useCountUp(value);
  const shown = animate ? counted : value;
  const s = SIZES[size];
  const full = formatBRL(value);

  if (hidden) {
    return (
      <ThemedText style={[styles.base, { fontSize: s.whole, lineHeight: s.line }, style]} themeColor={themeColor} accessibilityLabel="Valor oculto">
        {HIDDEN_VALUE}
      </ThemedText>
    );
  }
  const [whole, cents] = splitCents(formatBRL(shown));
  return (
    <ThemedText
      style={[styles.base, { fontSize: s.whole, lineHeight: s.line }, style]}
      themeColor={themeColor}
      accessibilityLabel={full}
      numberOfLines={1}
      adjustsFontSizeToFit>
      {whole}
      <ThemedText style={[styles.base, styles.cents, { fontSize: s.cents }, style]} themeColor={themeColor}>
        {cents}
      </ThemedText>
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  base: { fontWeight: 800, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  cents: { fontWeight: 700, letterSpacing: -0.2, opacity: 0.85 },
});
