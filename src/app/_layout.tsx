import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { SplashOverlay } from '@/components/splash-overlay';
import { UpdateBanner } from '@/components/update-banner';
import { Colors } from '@/constants/theme';
import { todayISO } from '@/domain/dates';
import { useDailySummaryScheduler } from '@/notifications/use-daily-summary-scheduler';
import { useNotificationRouting } from '@/notifications/use-notification-routing';
import { useFinance, useHydrated } from '@/store/finance-store';

SplashScreen.preventAutoHideAsync();

/** Tema da navegação com as cores do app (headers e fundo das telas). */
function navigationTheme(dark: boolean) {
  const base = dark ? DarkTheme : DefaultTheme;
  const c = Colors[dark ? 'dark' : 'light'];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.background,
      card: c.background,
      text: c.text,
      border: c.border,
    },
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const hydrated = useHydrated();
  const closeCycles = useFinance((s) => s.closeCycles);

  // Ao abrir o app, salva a "foto" dos ciclos que terminaram (histórico e poupança).
  useEffect(() => {
    if (hydrated) closeCycles(todayISO());
  }, [hydrated, closeCycles]);

  // Resumo diário por notificação, sempre com os dados mais recentes.
  useDailySummaryScheduler(hydrated);
  useNotificationRouting(hydrated);

  return (
    <ThemeProvider value={navigationTheme(colorScheme === 'dark')}>
      {hydrated ? (
        <Stack
          screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '700' },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="expense" options={{ presentation: 'modal', title: 'Gasto' }} />
          <Stack.Screen name="category" options={{ presentation: 'modal', title: 'Categoria' }} />
          <Stack.Screen name="fixed-bill" options={{ presentation: 'modal', title: 'Conta fixa' }} />
          <Stack.Screen name="card" options={{ presentation: 'modal', title: 'Cartão' }} />
          <Stack.Screen name="income" options={{ presentation: 'modal', title: 'Renda extra' }} />
          <Stack.Screen name="receivable" options={{ presentation: 'modal', title: 'Devedor' }} />
          <Stack.Screen name="agreement" options={{ presentation: 'modal', title: 'Acordo mensal' }} />
          <Stack.Screen name="assistant" options={{ title: 'Assistente' }} />
          <Stack.Screen name="import" options={{ title: 'Importar extrato' }} />
          <Stack.Screen name="history" options={{ title: 'Histórico e poupança' }} />
        </Stack>
      ) : null}
      {hydrated ? <UpdateBanner /> : null}
      <SplashOverlay ready={hydrated} />
    </ThemeProvider>
  );
}
