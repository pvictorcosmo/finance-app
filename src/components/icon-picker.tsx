import { Pressable, StyleSheet, View } from 'react-native';

import { CATEGORY_ICONS, categoryIcon, Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useSeriesColor } from '@/constants/series-colors';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export { categoryIcon };

/** Grade de ícones para escolher o de uma categoria. */
export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: IconName;
  color: string;
  onChange: (icon: IconName) => void;
}) {
  const theme = useTheme();
  const series = useSeriesColor();
  const c = series(color);
  return (
    <View style={styles.field}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
        Ícone
      </ThemedText>
      <View style={styles.grid}>
        {CATEGORY_ICONS.map((name) => {
          const selected = name === value;
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Ícone ${name}`}
              onPress={() => onChange(name)}
              style={({ pressed }) => [
                styles.cell,
                {
                  backgroundColor: selected ? `${c}22` : theme.backgroundElement,
                  borderColor: selected ? c : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <Icon name={name} size={22} color={selected ? c : theme.textSecondary} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: { width: 52, height: 52, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
