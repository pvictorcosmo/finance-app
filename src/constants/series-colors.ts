import { useCallback } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Paleta das categorias e cartões. São 8 cores validadas para daltonismo
 * (deuteranopia/protanopia/tritanopia) e para contraste no fundo claro e escuro.
 * O app salva a cor do modo claro e troca pela versão escura na hora de desenhar.
 */
export const SERIES_COLORS = [
  '#2a78d6', // azul
  '#eb6834', // laranja
  '#1baf7a', // água
  '#eda100', // amarelo
  '#e87ba4', // magenta
  '#008300', // verde
  '#6250d6', // violeta
  '#e34948', // vermelho
] as const;

/** Roxo (estilo Nubank), só para cartões: não entra nos gráficos, então não conta na paleta acima. */
export const CARD_PURPLE = '#8A05BE';

/** Cores disponíveis para cartões: a paleta + roxo, ao lado do violeta. */
export const CARD_COLORS = [...SERIES_COLORS.slice(0, 7), CARD_PURPLE, SERIES_COLORS[7]] as const;

/** Nomes das cores (leitores de tela). */
export const COLOR_NAMES: Record<string, string> = {
  '#2a78d6': 'Azul',
  '#eb6834': 'Laranja',
  '#1baf7a': 'Verde-água',
  '#eda100': 'Amarelo',
  '#e87ba4': 'Rosa',
  '#008300': 'Verde',
  '#6250d6': 'Violeta',
  [CARD_PURPLE]: 'Roxo',
  '#e34948': 'Vermelho',
};

const DARK: Record<string, string> = {
  '#2a78d6': '#3987e5',
  '#eb6834': '#d95926',
  '#1baf7a': '#199e70',
  '#eda100': '#c98500',
  '#e87ba4': '#d55181',
  '#008300': '#008300',
  '#6250d6': '#9085e9',
  '#e34948': '#e66767',
  [CARD_PURPLE]: '#9B3FD9',
};

/** Retorna uma função que converte a cor salva para a do tema atual. */
export function useSeriesColor() {
  const dark = useColorScheme() === 'dark';
  return useCallback((color: string) => (dark ? (DARK[color] ?? color) : color), [dark]);
}
