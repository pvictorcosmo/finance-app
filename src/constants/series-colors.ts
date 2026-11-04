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

const DARK: Record<string, string> = {
  '#2a78d6': '#3987e5',
  '#eb6834': '#d95926',
  '#1baf7a': '#199e70',
  '#eda100': '#c98500',
  '#e87ba4': '#d55181',
  '#008300': '#008300',
  '#6250d6': '#9085e9',
  '#e34948': '#e66767',
};

/** Cores da primeira versão do app -> cor equivalente da paleta nova. */
export const LEGACY_COLORS: Record<string, string> = {
  '#208AEF': '#2a78d6',
  '#30A46C': '#1baf7a',
  '#F76B15': '#eb6834',
  '#E5484D': '#e34948',
  '#8E4EC6': '#6250d6',
  '#D6409F': '#e87ba4',
  '#12A594': '#008300',
  '#FFB224': '#eda100',
  '#6E56CF': '#6250d6',
  '#5B5BD6': '#2a78d6',
};

/** Retorna uma função que converte a cor salva para a do tema atual. */
export function useSeriesColor() {
  const dark = useColorScheme() === 'dark';
  return useCallback((color: string) => (dark ? (DARK[color] ?? color) : color), [dark]);
}
