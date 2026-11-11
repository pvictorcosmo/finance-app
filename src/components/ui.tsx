import { useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconBadge, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSeriesColor } from '@/constants/series-colors';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useTheme } from '@/hooks/use-theme';

/** Web tab bar height (expo-router/ui), drawn over the content. */
const WEB_TAB_BAR = 76;

/**
 * Distance from the floating button to the bottom of a tab screen, right above the tab bar.
 * - Android: native tabs already lay the content out above the bar (automatic SafeAreaView),
 *   so a margin is enough.
 * - iOS: content goes under the bar, but the bottom safe-area inset already includes its height.
 * - Web: the bar is drawn over the content.
 * @param safeBottom Bottom safe-area inset.
 */
function fabBottom(safeBottom: number): number {
  return Platform.select({
    android: Spacing.three,
    ios: safeBottom + Spacing.two,
    default: WEB_TAB_BAR + Spacing.three,
  });
}

/**
 * "Pull to refresh" spinner in the app colors: syncs pending changes with the cloud
 * and checks for an over-the-air update (see `refreshApp` in hooks/use-pull-to-refresh).
 */
export function AppRefreshControl() {
  const theme = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();
  return (
    <RefreshControl
      testID="pull-to-refresh"
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={theme.primary}
      colors={[theme.primary]}
      progressBackgroundColor={theme.backgroundElement}
    />
  );
}

/** Tab screen: large title, optional action on the right, scrolling, pull to refresh and a floating button. */
export function Screen({
  title,
  subtitle,
  children,
  fab,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  fab?: ReactNode;
  action?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<AppRefreshControl />}
        contentContainerStyle={[
          styles.content,
          // Room at the end so the floating button does not cover the last item.
          { paddingTop: insets.top + Spacing.four, paddingBottom: fabBottom(insets.bottom) + 80 },
        ]}>
        <Row style={styles.screenHeader}>
          <View style={styles.flex}>
            <ThemedText type="subtitle">{title}</ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {action}
        </Row>
        {children}
      </ScrollView>
      {fab}
    </ThemedView>
  );
}

/** Form screen (opened as a modal with the Stack header), with pull to refresh. */
export function FormScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<AppRefreshControl />}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        {children}
      </ScrollView>
    </ThemedView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ThemedView type="backgroundElement" style={[styles.card, styles.shadow, style]}>
      {children}
    </ThemedView>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={styles.sectionHeader}>
      <ThemedText type="heading">{title}</ThemedText>
      {action}
    </Row>
  );
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  const series = useSeriesColor();
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: series(color) }} />;
}

/** Linha fina entre itens de uma lista dentro de um card. */
export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  compact,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  icon?: IconName;
}) {
  const theme = useTheme();
  const bg = {
    primary: theme.primary,
    secondary: theme.primarySoft,
    danger: theme.dangerSoft,
    ghost: 'transparent',
  }[variant];
  const fg = {
    primary: theme.onPrimary,
    secondary: theme.accent,
    danger: theme.danger,
    ghost: theme.accent,
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        pressed && styles.pressedScale,
      ]}>
      {icon ? <Icon name={icon} size={compact ? 16 : 18} color={fg} /> : null}
      <ThemedText type="smallBold" style={{ color: fg, fontSize: compact ? 14 : 16 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Botão circular só com ícone (ex.: setas de navegação). */
export function IconButton({
  icon,
  onPress,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
      <Icon name={icon} size={18} color={theme.text} />
    </Pressable>
  );
}

/** Botão flutuante acima da barra de abas. */
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
        {
          backgroundColor: theme.primary,
          shadowColor: theme.primary,
          bottom: fabBottom(insets.bottom),
        },
        pressed && styles.pressedScale,
      ]}>
      <Icon name="add" size={22} color={theme.onPrimary} />
      <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: focused ? theme.primary : theme.border,
          },
          input.style,
        ]}
      />
      {hint ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Campo de valor em destaque: "R$" + número grande, centralizado. */
export function AmountInput({
  label,
  value,
  onChangeText,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.amountWrap}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <Row style={styles.amountRow}>
        <ThemedText type="amount" themeColor="textSecondary">
          R$
        </ThemedText>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={theme.border}
          autoFocus={autoFocus}
          accessibilityLabel={label}
          // Largura acompanha o texto, para "R$ 123,45" ficar centralizado como um bloco.
          style={[styles.amountInput, { color: theme.text, width: Math.max(4, (value || '0,00').length) * 29 + 8 }]}
        />
      </Row>
    </View>
  );
}

export interface ChipOption<T> {
  value: T;
  label: string;
  color?: string;
  icon?: IconName;
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
  const series = useSeriesColor();
  return (
    <View style={styles.field}>
      {label ? (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <View style={styles.chips}>
        {options.map((opt) => {
          const selected = opt.value === value;
          const fg = selected ? theme.onPrimary : theme.text;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(opt.value)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected ? theme.primary : theme.backgroundElement,
                  borderColor: selected ? theme.primary : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              {opt.icon ? (
                <Icon name={opt.icon} size={16} color={selected ? fg : opt.color ? series(opt.color) : theme.textSecondary} />
              ) : opt.color ? (
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: series(opt.color), borderColor: selected ? theme.onPrimary : 'transparent' },
                  ]}
                />
              ) : null}
              <ThemedText type={selected ? 'smallBold' : 'small'} style={{ color: fg }}>
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Seletor numérico com − e + (por padrão: dia do mês, 1–31, circular). */
export function DayStepper({
  label,
  value,
  onChange,
  hint,
  min = 1,
  max = 31,
  format = (v) => `Dia ${v}`,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  min?: number;
  max?: number;
  format?: (value: number) => string;
}) {
  const theme = useTheme();
  const size = max - min + 1;
  const step = (n: number) => onChange(((value - min + n + size) % size) + min);
  return (
    <View style={styles.field}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <Row style={[styles.stepper, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Pressable
          accessibilityLabel="Diminuir"
          onPress={() => step(-1)}
          style={({ pressed }) => [styles.stepBtn, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
          <ThemedText type="heading">−</ThemedText>
        </Pressable>
        <ThemedText type="heading" style={styles.stepValue}>
          {format(value)}
        </ThemedText>
        <Pressable
          accessibilityLabel="Aumentar"
          onPress={() => step(1)}
          style={({ pressed }) => [styles.stepBtn, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
          <Icon name="add" size={18} color={theme.text} />
        </Pressable>
      </Row>
      {hint ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Caixinha de marcar (pago/recebido). */
export function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={[
        styles.check,
        { borderColor: checked ? theme.success : theme.border },
        checked && { backgroundColor: theme.success },
      ]}>
      {checked ? <Icon name="check" size={14} color={theme.backgroundElement} /> : null}
    </Pressable>
  );
}

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

/** Etiqueta de status em pílula, com ícone + texto (nunca só cor). */
export function Badge({ tone, label }: { tone: Tone; label: string }) {
  const theme = useTheme();
  const { fg, bg } = toneColors(theme, tone);
  const icon = { success: '✓', warning: '!', danger: '!', neutral: '•', accent: '•' }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText type="caption" style={{ color: fg, fontWeight: 600 }}>
        {icon} {label}
      </ThemedText>
    </View>
  );
}

export function toneColors(theme: ReturnType<typeof useTheme>, tone: Tone) {
  switch (tone) {
    case 'success':
      return { fg: theme.success, bg: theme.successSoft };
    case 'warning':
      return { fg: theme.warning, bg: theme.warningSoft };
    case 'danger':
      return { fg: theme.danger, bg: theme.dangerSoft };
    case 'accent':
      return { fg: theme.accent, bg: theme.primarySoft };
    default:
      return { fg: theme.textSecondary, bg: theme.backgroundSelected };
  }
}

/** Barra de progresso com marcador opcional (ex.: onde deveria estar no ritmo do mês). */
export function ProgressBar({
  value,
  max,
  color,
  marker,
  height = 8,
  trackColor,
}: {
  value: number;
  max: number;
  color: string;
  /** 0–1 */
  marker?: number;
  height?: number;
  trackColor?: string;
}) {
  const theme = useTheme();
  const series = useSeriesColor();
  const ratio = max > 0 ? Math.min(1, value / max) : value > 0 ? 1 : 0;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor ?? theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: `${ratio * 100}%`, borderRadius: height / 2, backgroundColor: series(color) }]} />
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
      <ThemedText type="smallBold" style={color ? { color } : undefined}>
        {value}
      </ThemedText>
    </Row>
  );
}

/** Mini-card de número (ex.: Poupança, A receber). */
export function StatTile({
  label,
  value,
  icon,
  tone = 'accent',
  hint,
  onPress,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: Tone;
  hint?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const { fg, bg } = toneColors(theme, tone);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.flex, pressed && styles.pressed]}>
      <Card style={styles.tile}>
        <View style={[styles.tileIcon, { backgroundColor: bg }]}>
          <Icon name={icon} size={18} color={fg} />
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="amount" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </ThemedText>
        {hint ? (
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
            {hint}
          </ThemedText>
        ) : null}
      </Card>
    </Pressable>
  );
}

export function EmptyState({ text, action, icon = 'tag' }: { text: string; action?: ReactNode; icon?: IconName }) {
  const theme = useTheme();
  return (
    <Card style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
        <Icon name={icon} size={26} color={theme.accent} />
      </View>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        {text}
      </ThemedText>
      {action}
    </Card>
  );
}

/** Item clicável de lista: ícone (ou ponto colorido), título, subtítulo e conteúdo à direita. */
export function ListItem({
  title,
  subtitle,
  right,
  color,
  icon,
  onPress,
  subtitleColor,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  color?: string;
  icon?: IconName;
  onPress?: () => void;
  subtitleColor?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Row style={styles.listItem}>
        {icon ? (
          <IconBadge name={icon} color={color ?? theme.textSecondary} />
        ) : color ? (
          <View style={styles.dotSlot}>
            <Dot color={color} size={12} />
          </View>
        ) : null}
        <View style={styles.flex}>
          <ThemedText type="default" numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText
              type="caption"
              themeColor="textSecondary"
              numberOfLines={2}
              style={subtitleColor ? { color: subtitleColor } : undefined}>
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
  screenHeader: { alignItems: 'flex-end', marginBottom: Spacing.one },
  card: { borderRadius: 22, padding: Spacing.three, gap: Spacing.two },
  shadow: Platform.select({
    ios: { shadowColor: '#0E0F13', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 1 },
    default: { boxShadow: '0 6px 16px rgba(14,15,19,0.06)' },
  }) as ViewStyle,
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionHeader: { justifyContent: 'space-between', marginTop: Spacing.three, minHeight: 36 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
  button: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  buttonCompact: { minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: 12 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: Spacing.three,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.four,
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  field: { gap: 6 },
  label: { textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  amountWrap: { alignItems: 'center', paddingVertical: Spacing.three, gap: Spacing.one },
  amountRow: { justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' },
  amountInput: {
    fontSize: 48,
    fontWeight: 800,
    letterSpacing: -1,
    maxWidth: '85%',
    textAlign: 'left',
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  stepper: {
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 6,
  },
  stepBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepValue: { flex: 1, textAlign: 'center' },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  track: { overflow: 'hidden' },
  fill: { height: '100%' },
  marker: { position: 'absolute', top: -2, bottom: -2, width: 2, opacity: 0.5 },
  kv: { justifyContent: 'space-between' },
  tile: { flex: 1, gap: 4 },
  tileIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  empty: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  listItem: { paddingVertical: 10, gap: Spacing.three },
  dotSlot: { width: 40, alignItems: 'center' },
  pressed: { opacity: 0.6 },
  pressedScale: { transform: [{ scale: 0.97 }] },
});
