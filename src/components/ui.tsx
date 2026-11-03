import { type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Tela de aba: título próprio, rolagem e botão flutuante opcional. */
export function Screen({
  title,
  subtitle,
  children,
  fab,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  fab?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + 96 },
        ]}>
        <View>
          <ThemedText type="subtitle">{title}</ThemedText>
          {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
        </View>
        {children}
      </ScrollView>
      {fab}
    </ThemedView>
  );
}

/** Tela de formulário (abre como modal, com header do Stack). */
export function FormScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        {children}
      </ScrollView>
    </ThemedView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <ThemedView type="backgroundElement" style={[styles.card, style]}>
      {children}
    </ThemedView>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={styles.sectionHeader}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.upper}>
        {title}
      </ThemedText>
      {action}
    </Row>
  );
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
}) {
  const theme = useTheme();
  const bg = {
    primary: theme.primary,
    secondary: theme.backgroundSelected,
    danger: 'transparent',
    ghost: 'transparent',
  }[variant];
  const fg = {
    primary: theme.onPrimary,
    secondary: theme.text,
    danger: theme.danger,
    ghost: theme.primary,
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        variant === 'danger' && { borderWidth: 1, borderColor: theme.danger },
      ]}>
      <ThemedText type="smallBold" style={{ color: fg }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Botão flutuante "+" acima da barra de abas. */
export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: theme.primary, bottom: insets.bottom + BottomTabInset + Spacing.three, opacity: pressed ? 0.8 : 1 },
      ]}>
      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
        ＋ {label}
      </ThemedText>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...input
}: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...input}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
          input.style,
        ]}
      />
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export interface ChipOption<T> {
  value: T;
  label: string;
  color?: string;
}

/** Lista de opções selecionáveis (uma por vez). */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: ChipOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <View style={styles.chips}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(opt.value)}
              style={[
                styles.chip,
                {
                  borderColor: selected ? theme.primary : theme.border,
                  backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                },
              ]}>
              {opt.color ? <Dot color={opt.color} /> : null}
              <ThemedText type={selected ? 'smallBold' : 'small'}>{opt.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Seletor de dia do mês (1–31) com − e +. */
export function DayStepper({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (day: number) => void;
  hint?: string;
}) {
  const theme = useTheme();
  const step = (n: number) => onChange(((value - 1 + n + 31) % 31) + 1);
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Row style={styles.stepper}>
        <Pressable onPress={() => step(-1)} style={[styles.stepBtn, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">−</ThemedText>
        </Pressable>
        <ThemedText type="default" style={styles.stepValue}>
          Dia {value}
        </ThemedText>
        <Pressable onPress={() => step(1)} style={[styles.stepBtn, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">＋</ThemedText>
        </Pressable>
      </Row>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Barra de progresso com marcador opcional (ex.: onde deveria estar no ritmo do mês). */
export function ProgressBar({
  value,
  max,
  color,
  marker,
}: {
  value: number;
  max: number;
  color: string;
  /** 0–1 */
  marker?: number;
}) {
  const theme = useTheme();
  const ratio = max > 0 ? Math.min(1, value / max) : value > 0 ? 1 : 0;
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      {marker !== undefined && marker > 0 && marker < 1 ? (
        <View style={[styles.marker, { left: `${marker * 100}%`, backgroundColor: theme.text }]} />
      ) : null}
    </View>
  );
}

/** Linha "rótulo ............ valor". */
export function KeyValue({
  label,
  value,
  strong,
  color,
}: {
  label: string;
  value: string;
  strong?: boolean;
  color?: string;
}) {
  return (
    <Row style={styles.kv}>
      <ThemedText type={strong ? 'smallBold' : 'small'} themeColor={strong ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
      <ThemedText type={strong ? 'smallBold' : 'small'} style={color ? { color } : undefined}>
        {value}
      </ThemedText>
    </Row>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <Card style={styles.empty}>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        {text}
      </ThemedText>
      {action}
    </Card>
  );
}

/** Item clicável de lista. */
export function ListItem({
  title,
  subtitle,
  right,
  color,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Row style={styles.listItem}>
        {color ? <Dot color={color} size={12} /> : null}
        <View style={styles.flex}>
          <ThemedText type="default" numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {typeof right === 'string' ? <ThemedText type="smallBold">{right}</ThemedText> : right}
      </Row>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionHeader: { justifyContent: 'space-between', marginTop: Spacing.two },
  upper: { textTransform: 'uppercase', letterSpacing: 0.5 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 36, paddingHorizontal: Spacing.two },
  fab: {
    position: 'absolute',
    right: Spacing.three,
    paddingHorizontal: Spacing.four,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  stepper: { gap: Spacing.three },
  stepBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 70, textAlign: 'center' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2, opacity: 0.6 },
  kv: { justifyContent: 'space-between' },
  empty: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
  center: { textAlign: 'center' },
  listItem: { paddingVertical: Spacing.two, gap: Spacing.three },
  pressed: { opacity: 0.6 },
});
