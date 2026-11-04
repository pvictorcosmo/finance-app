import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Card de destaque com gradiente da marca. Texto sempre branco. */
export function HeroCard({ children, colors }: { children: ReactNode; colors?: readonly [string, string] }) {
  const theme = useTheme();
  return (
    <LinearGradient
      colors={colors ?? [theme.heroFrom, theme.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}>
      {/* Círculos decorativos discretos */}
      <View style={[styles.blob, styles.blobA]} />
      <View style={[styles.blob, styles.blobB]} />
      {children}
    </LinearGradient>
  );
}

export function HeroText({
  children,
  type = 'small',
  dim,
}: {
  children: ReactNode;
  type?: 'small' | 'smallBold' | 'caption' | 'title' | 'amount' | 'heading';
  dim?: boolean;
}) {
  return (
    <ThemedText type={type} style={{ color: dim ? 'rgba(255,255,255,0.78)' : '#FFFFFF' }}>
      {children}
    </ThemedText>
  );
}

/** Escurece uma cor hex (para o gradiente dos cartões). */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * (1 - amount))));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

const styles = StyleSheet.create({
  hero: { borderRadius: 26, padding: Spacing.four, gap: Spacing.two, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  blobA: { width: 220, height: 220, top: -90, right: -60 },
  blobB: { width: 140, height: 140, bottom: -70, left: -30 },
});
