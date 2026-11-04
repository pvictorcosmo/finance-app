import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { todayISO } from '@/domain/dates';
import { useFinance, useHydrated } from '@/store/finance-store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const hydrated = useHydrated();
  const closeCycles = useFinance((s) => s.closeCycles);

  // Ao abrir o app, salva a "foto" dos ciclos que terminaram (histórico e poupança).
  useEffect(() => {
    if (hydrated) closeCycles(todayISO());
  }, [hydrated, closeCycles]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {hydrated ? (
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="expense" options={{ presentation: 'modal', title: 'Gasto' }} />
          <Stack.Screen name="category" options={{ presentation: 'modal', title: 'Categoria' }} />
          <Stack.Screen name="fixed-bill" options={{ presentation: 'modal', title: 'Conta fixa' }} />
          <Stack.Screen name="card" options={{ presentation: 'modal', title: 'Cartão' }} />
          <Stack.Screen name="income" options={{ presentation: 'modal', title: 'Renda extra' }} />
          <Stack.Screen name="receivable" options={{ presentation: 'modal', title: 'Devedor' }} />
          <Stack.Screen name="history" options={{ title: 'Histórico e poupança' }} />
        </Stack>
      ) : null}
      <AnimatedSplashOverlay />
    </ThemeProvider>
  );
}
