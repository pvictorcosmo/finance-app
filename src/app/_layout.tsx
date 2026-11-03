import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useHydrated } from '@/store/finance-store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const hydrated = useHydrated();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {hydrated ? (
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="expense" options={{ presentation: 'modal', title: 'Gasto' }} />
          <Stack.Screen name="category" options={{ presentation: 'modal', title: 'Categoria' }} />
          <Stack.Screen name="fixed-bill" options={{ presentation: 'modal', title: 'Conta fixa' }} />
          <Stack.Screen name="card" options={{ presentation: 'modal', title: 'Cartão' }} />
        </Stack>
      ) : null}
      <AnimatedSplashOverlay />
    </ThemeProvider>
  );
}
