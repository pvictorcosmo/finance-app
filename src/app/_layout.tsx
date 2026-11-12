import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { LoadError } from '@/components/load-error';
import { SplashOverlay } from '@/components/splash-overlay';
import { UpdateBanner } from '@/components/update-banner';
import { FONT_FILES, markFontsLoaded } from '@/constants/fonts';
import { Colors } from '@/constants/theme';
import { todayISO } from '@/domain/dates';
import { useDailySummaryScheduler } from '@/notifications/use-daily-summary-scheduler';
import { useNotificationRouting } from '@/notifications/use-notification-routing';
import { useCloudSync } from '@/sync/use-cloud-sync';
import { useFinance, useHydrated, useHydrationError } from '@/store/finance-store';

SplashScreen.preventAutoHideAsync();

/** How long to wait for the Inter files before starting with the system font. */
const FONT_TIMEOUT_MS = 2500;

/** Forms slide up from the bottom like a sheet (native modal sheet on iOS). */
const SHEET = {
  presentation: 'modal',
  animation: Platform.OS === 'android' ? 'slide_from_bottom' : undefined,
} as const;

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
  const loadError = useHydrationError();
  const closeCycles = useFinance((s) => s.closeCycles);
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const [fontTimeout, setFontTimeout] = useState(false);
  if (fontsLoaded) markFontsLoaded();
  // Never hold the app on a font problem: after a short wait it starts with the system font.
  const fontsReady = fontsLoaded || !!fontError || fontTimeout;

  useEffect(() => {
    const timer = setTimeout(() => setFontTimeout(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  // Last-resort safety net: never leave the native splash up, whatever happens in JS.
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 6000);
    return () => clearTimeout(timer);
  }, []);

  // Ao abrir o app, salva a "foto" dos ciclos que terminaram (histórico e poupança).
  useEffect(() => {
    if (hydrated) closeCycles(todayISO());
  }, [hydrated, closeCycles]);

  // Resumo diário por notificação, sempre com os dados mais recentes.
  useDailySummaryScheduler(hydrated);
  useNotificationRouting(hydrated);
  // Cloud sync (local-first): runs while a user is signed in.
  useCloudSync(hydrated);

  return (
    <ThemeProvider value={navigationTheme(colorScheme === 'dark')}>
      {hydrated ? (
        <Stack
          screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
            headerShadowVisible: false,
            headerTitleStyle: fontsLoaded ? { fontFamily: 'Inter_700Bold' } : { fontWeight: '700' },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="expense" options={{ ...SHEET, title: 'Gasto' }} />
          <Stack.Screen name="category" options={{ ...SHEET, title: 'Categoria' }} />
          <Stack.Screen name="fixed-bill" options={{ ...SHEET, title: 'Conta fixa' }} />
          <Stack.Screen name="card" options={{ ...SHEET, title: 'Cartão' }} />
          <Stack.Screen name="income" options={{ ...SHEET, title: 'Renda extra' }} />
          <Stack.Screen name="receivable" options={{ ...SHEET, title: 'Devedor' }} />
          <Stack.Screen name="agreement" options={{ ...SHEET, title: 'Acordo mensal' }} />
          <Stack.Screen name="assistant" options={{ title: 'Assistente' }} />
          <Stack.Screen name="import" options={{ title: 'Importar extrato' }} />
          <Stack.Screen name="calendar" options={{ headerShown: false }} />
          <Stack.Screen name="receivables" options={{ headerShown: false }} />
          <Stack.Screen name="history" options={{ title: 'Histórico e poupança' }} />
        </Stack>
      ) : null}
      {hydrated && fontsReady ? <UpdateBanner /> : null}
      {!hydrated && loadError ? <LoadError error={loadError} /> : null}
      <SplashOverlay ready={(hydrated && fontsReady) || !!loadError} />
    </ThemeProvider>
  );
}
