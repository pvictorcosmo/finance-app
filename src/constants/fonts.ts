import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import type { TextStyle } from 'react-native';

/** Inter files loaded at startup (see `useAppFonts`), keyed by the family name used in styles. */
export const FONT_FILES = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

type Family = keyof typeof FONT_FILES;

const BY_WEIGHT: Record<number, Family> = {
  100: 'Inter_400Regular',
  200: 'Inter_400Regular',
  300: 'Inter_400Regular',
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
  900: 'Inter_800ExtraBold',
};

let loaded = false;

/** Called once the font files are ready; until then text keeps the system font. */
export function markFontsLoaded(): void {
  loaded = true;
}

/**
 * Inter family for a font weight. Custom fonts ship one file per weight, so the
 * weight is expressed by the family and `fontWeight` is reset (otherwise Android
 * would fake-bold an already bold file).
 * @param weight `fontWeight` from the style ('bold', 600, '700'…).
 * @returns Style to merge last, or `null` while the fonts are not loaded.
 */
export function interFor(weight: TextStyle['fontWeight']): Pick<TextStyle, 'fontFamily' | 'fontWeight'> | null {
  if (!loaded) return null;
  const n = weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : Number(weight);
  return { fontFamily: BY_WEIGHT[Number.isFinite(n) ? n : 400] ?? 'Inter_400Regular', fontWeight: 'normal' };
}
