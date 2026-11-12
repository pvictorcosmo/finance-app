import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { interFor } from '@/constants/fonts';
import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'heading'
    | 'caption'
    | 'amount'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

/**
 * Text in the app's type scale and colors. Uses Inter (once loaded) with the file
 * matching the style's weight, unless the style sets its own `fontFamily`.
 */
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const flat: TextStyle = StyleSheet.flatten([styles[type], style]) ?? {};
  const font = flat.fontFamily ? null : interFor(flat.fontWeight);

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, flat, font]} {...rest} />;
}

const styles = StyleSheet.create({
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 500,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 400,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  default: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 500,
  },
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
    letterSpacing: -0.2,
  },
  /** Valores em destaque (saldo, total). */
  amount: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 40,
    fontWeight: 800,
    lineHeight: 46,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  subtitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 800,
    letterSpacing: -0.6,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#5B57E8',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
