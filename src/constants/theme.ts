/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Tokens de cor. `background` é o fundo da tela, `backgroundElement` a superfície
 * dos cards e `backgroundSelected` campos, trilhas e chips não selecionados.
 * `primary` é para preenchimentos (botões, gradiente); `accent` para texto/ícone de destaque.
 */
export const Colors = {
  light: {
    text: '#0E0F13',
    background: '#F3F4F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#ECEEF2',
    textSecondary: '#6B6F7B',
    border: '#E3E5EB',
    primary: '#5B57E8',
    primarySoft: '#ECEBFD',
    accent: '#4F4BD9',
    onPrimary: '#FFFFFF',
    heroFrom: '#5B57E8',
    heroTo: '#8E5CF7',
    success: '#15803D',
    successSoft: '#E7F6EC',
    warning: '#B45309',
    warningSoft: '#FDF1E3',
    danger: '#DC2626',
    dangerSoft: '#FDECEC',
  },
  dark: {
    text: '#F5F6F8',
    background: '#0A0A0D',
    backgroundElement: '#16171C',
    backgroundSelected: '#22242B',
    textSecondary: '#9A9EAB',
    border: '#2A2C34',
    primary: '#6C69F5',
    primarySoft: '#24234A',
    accent: '#A5A3FF',
    onPrimary: '#FFFFFF',
    heroFrom: '#4B47D6',
    heroTo: '#7A3FE4',
    success: '#4ADE80',
    successSoft: '#13291C',
    warning: '#FBBF24',
    warningSoft: '#2E2410',
    danger: '#F87171',
    dangerSoft: '#341A1A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
