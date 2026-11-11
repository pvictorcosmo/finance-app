import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { retryHydration } from '@/store/finance-store';

/**
 * Shown instead of the app when the data saved on the device cannot be loaded.
 * The regular screens are not rendered on purpose: they could save an empty state
 * over the user's real data.
 *
 * @param error - The load error, shown so it can be reported.
 */
export function LoadError({ error }: { error: unknown }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [retrying, setRetrying] = useState(false);
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.five }]}>
      <View style={[styles.icon, { backgroundColor: theme.dangerSoft }]}>
        <Icon name="warning" size={28} color={theme.danger} />
      </View>
      <ThemedText type="heading" style={styles.center}>
        Não foi possível carregar seus dados
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        Seus dados não foram apagados. Tente de novo; se continuar, envie o detalhe abaixo para o suporte.
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" selectable style={styles.detail}>
        {detail}
      </ThemedText>
      <Button
        label={retrying ? 'Carregando…' : 'Tentar novamente'}
        icon="repeat"
        disabled={retrying}
        onPress={async () => {
          setRetrying(true);
          await retryHydration();
          setRetrying(false);
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  icon: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  detail: { textAlign: 'center', fontFamily: 'monospace' },
});
