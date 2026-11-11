import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchLatestUpdate } from '@/updates/fetch-latest';

/**
 * Over-the-air updates: checks for a new version whenever the app returns to the
 * foreground and, once it has been downloaded, shows a banner to restart into it.
 * (On a cold start expo-updates already checks by itself.) Renders nothing in
 * development / Expo Go, where updates are disabled.
 */
export function UpdateBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (!Updates.isEnabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void fetchLatestUpdate();
    });
    return () => sub.remove();
  }, []);

  if (!Updates.isEnabled || !isUpdatePending) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nova versão pronta. Toque para reiniciar o app."
      onPress={() => void Updates.reloadAsync()}
      style={({ pressed }) => [
        styles.banner,
        { top: insets.top + Spacing.two, backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
      ]}>
      <Icon name="sparkles" size={18} color={theme.onPrimary} />
      <ThemedText type="smallBold" style={[styles.text, { color: theme.onPrimary }]}>
        Nova versão pronta
      </ThemedText>
      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
        Reiniciar
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 900,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { flex: 1 },
});
