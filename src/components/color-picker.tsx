import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { COLOR_NAMES, useSeriesColor } from '@/constants/series-colors';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY_COLORS } from '@/store/finance-store';

export function ColorPicker({
  value,
  onChange,
  colors = CATEGORY_COLORS,
}: {
  value: string;
  onChange: (color: string) => void;
  /** Cores oferecidas (padrão: paleta das categorias). */
  colors?: readonly string[];
}) {
  const theme = useTheme();
  const series = useSeriesColor();
  return (
    <View style={styles.field}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
        Cor{COLOR_NAMES[value] ? ` · ${COLOR_NAMES[value]}` : ''}
      </ThemedText>
      <View style={styles.row}>
        {colors.map((c, i) => {
          const selected = c === value;
          return (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={COLOR_NAMES[c] ?? `Cor ${i + 1}`}
              onPress={() => onChange(c)}
              style={[styles.swatch, { backgroundColor: series(c), borderColor: selected ? theme.text : 'transparent' }]}>
              {selected ? <Icon name="check" size={16} color="#FFFFFF" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
