import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useSeriesColor } from '@/constants/series-colors';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY_COLORS } from '@/store/finance-store';

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const theme = useTheme();
  const series = useSeriesColor();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        Cor
      </ThemedText>
      <View style={styles.row}>
        {CATEGORY_COLORS.map((c, i) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityState={{ selected: c === value }}
            accessibilityLabel={`Cor ${i + 1}`}
            onPress={() => onChange(c)}
            style={[styles.swatch, { backgroundColor: series(c), borderColor: c === value ? theme.text : 'transparent' }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
});
