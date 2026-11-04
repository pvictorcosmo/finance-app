import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Row } from '@/components/ui';
import { useSeriesColor } from '@/constants/series-colors';
import { Spacing } from '@/constants/theme';
import type { Cents } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export interface ColumnDatum {
  key: string;
  label: string;
  value: Cents;
  /** Referência desenhada como um traço sobre a coluna (ex.: livre do ciclo, limite da categoria). */
  target?: Cents;
  /** Coluna parcial (ciclo em andamento): desenhada mais clara. */
  partial?: boolean;
}

const PLOT_HEIGHT = 150;
const COLUMN_MAX = 24;

/** Arredonda para cima até um número "redondo" (1, 2, 2,5, 5 × 10^n). */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * exp >= value) return f * exp;
  return 10 * exp;
}

/** 150000 (centavos) -> "1,5 mil"; 80000 -> "800". */
export function compactBRL(cents: Cents): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 1000) {
    const k = reais / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1).replace('.', ',')} mil`;
  }
  return String(Math.round(reais));
}

/**
 * Gráfico de colunas de uma série, com eixo Y único, grade discreta,
 * traço de referência opcional e toque para selecionar (detalhe fica abaixo).
 */
export function ColumnChart({
  data,
  color,
  selectedKey,
  onSelect,
  valueLabel,
  targetLabel,
}: {
  data: ColumnDatum[];
  color: string;
  selectedKey?: string;
  onSelect: (key: string) => void;
  valueLabel: string;
  targetLabel?: string;
}) {
  const theme = useTheme();
  const series = useSeriesColor();
  const fill = series(color);
  const top = niceCeil(Math.max(...data.map((d) => Math.max(d.value, d.target ?? 0)), 1));
  const ticks = [top, top / 2, 0];
  const y = (v: number) => (Math.max(0, v) / top) * PLOT_HEIGHT;
  const hasTarget = data.some((d) => d.target !== undefined);

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel={`Gráfico de ${valueLabel.toLowerCase()} por ciclo`}>
      <Row style={styles.legend}>
        <Row style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: fill }]} />
          <ThemedText type="small" themeColor="textSecondary">
            {valueLabel}
          </ThemedText>
        </Row>
        {hasTarget && targetLabel ? (
          <Row style={styles.legendItem}>
            <View style={[styles.targetKey, { backgroundColor: theme.text }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {targetLabel}
            </ThemedText>
          </Row>
        ) : null}
      </Row>

      <View style={styles.chart}>
        <View style={[styles.axis, { height: PLOT_HEIGHT }]}>
          {ticks.map((t) => (
            <ThemedText key={t} type="small" themeColor="textSecondary" style={styles.tick}>
              {compactBRL(t)}
            </ThemedText>
          ))}
        </View>

        <View style={styles.flex}>
          <View style={{ height: PLOT_HEIGHT }}>
            {ticks.map((t) => (
              <View
                key={t}
                style={[styles.grid, { bottom: y(t), backgroundColor: t === 0 ? theme.textSecondary : theme.border }]}
              />
            ))}
            <View style={styles.columns}>
              {data.map((d) => {
                const selected = d.key === selectedKey;
                return (
                  <Pressable
                    key={d.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${d.label}: ${compactBRL(d.value)} reais`}
                    onPress={() => onSelect(d.key)}
                    style={styles.slot}>
                    {selected ? (
                      <ThemedText type="smallBold" style={[styles.valueLabel, { bottom: y(d.value) + 2 }]}>
                        {compactBRL(d.value)}
                      </ThemedText>
                    ) : null}
                    <View
                      style={[
                        styles.column,
                        {
                          height: Math.max(d.value > 0 ? 2 : 0, y(d.value)),
                          backgroundColor: fill,
                          opacity: d.partial ? 0.45 : 1,
                        },
                      ]}
                    />
                    {d.target !== undefined ? (
                      <View style={[styles.target, { bottom: y(d.target) - 1, backgroundColor: theme.text }]} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.labels}>
            {data.map((d) => (
              <ThemedText
                key={d.key}
                type={d.key === selectedKey ? 'smallBold' : 'small'}
                themeColor={d.key === selectedKey ? 'text' : 'textSecondary'}
                style={styles.xLabel}
                numberOfLines={1}>
                {d.label}
              </ThemedText>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  flex: { flex: 1 },
  legend: { gap: Spacing.three, flexWrap: 'wrap' },
  legendItem: { gap: Spacing.one },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  targetKey: { width: 14, height: 2 },
  chart: { flexDirection: 'row', gap: Spacing.one },
  axis: { width: 44, justifyContent: 'space-between', marginTop: -8, marginBottom: -8 },
  tick: { fontSize: 11, lineHeight: 16, textAlign: 'right' },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  columns: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  column: { width: COLUMN_MAX, maxWidth: '70%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  target: { position: 'absolute', width: COLUMN_MAX + 12, maxWidth: '95%', height: 2, opacity: 0.8 },
  valueLabel: { position: 'absolute', fontSize: 11, lineHeight: 14 },
  labels: { flexDirection: 'row', marginTop: Spacing.one },
  xLabel: { flex: 1, textAlign: 'center', fontSize: 12 },
});
