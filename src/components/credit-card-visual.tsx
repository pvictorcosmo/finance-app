import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { shade } from '@/components/hero-card';
import { Icon } from '@/components/icon';
import { MoneyText } from '@/components/money-text';
import { AnimatedFill, PressableScale } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { useSeriesColor } from '@/constants/series-colors';
import { Spacing } from '@/constants/theme';
import { formatShort } from '@/domain/dates';
import type { Invoice } from '@/domain/invoice';
import type { Cents, CreditCard } from '@/domain/types';
import { useMoney } from '@/store/ui-store';

/** ISO/IEC 7810 ID-1: the shape of a real bank card. */
export const CARD_ASPECT = 85.6 / 53.98;

const WHITE = '#FFFFFF';
const DIM = 'rgba(255,255,255,0.78)';

/**
 * A credit card drawn like the physical one: gradient in the card's color, chip,
 * contactless mark, the open bill in large type and the used limit at the bottom.
 * @param card The card.
 * @param open Its open invoice, if any.
 * @param used Limit taken by everything not paid yet (future installments included).
 * @param width Card width; the height follows the real card proportion.
 * @param onEdit Opens the card settings.
 */
export function CreditCardVisual({
  card,
  open,
  used,
  width,
  onEdit,
}: {
  card: CreditCard;
  open?: Invoice;
  used: Cents;
  width: number;
  onEdit: () => void;
}) {
  const series = useSeriesColor();
  const { money } = useMoney();
  const base = series(card.color);
  const overLimit = !!card.limit && used > card.limit;

  return (
    <LinearGradient
      colors={[base, shade(base, 0.55)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { width, height: width / CARD_ASPECT }]}>
      {/* Soft light reflections, like the plastic of a real card. */}
      <View style={[styles.shine, styles.shineA]} />
      <View style={[styles.shine, styles.shineB]} />

      <View style={styles.top}>
        <ThemedText type="heading" style={styles.white} numberOfLines={1}>
          {card.name}
        </ThemedText>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Editar ${card.name}`}
          hitSlop={10}
          scaleTo={0.9}
          feedback="selection"
          onPress={onEdit}
          style={styles.edit}>
          <Icon name="edit" size={16} color={WHITE} />
        </PressableScale>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <View style={styles.chipLine} />
          <View style={[styles.chipLine, styles.chipLineV]} />
        </View>
        <Icon name="contactless" size={20} color={DIM} />
      </View>

      <View style={styles.bottom}>
        <ThemedText type="caption" style={styles.dim}>
          FATURA ABERTA
        </ThemedText>
        <MoneyText value={open?.total ?? 0} style={styles.white} />
        <ThemedText type="caption" style={styles.dim} numberOfLines={1}>
          {open ? `fecha ${formatShort(open.closing)} · vence ${formatShort(open.due)}` : `fecha dia ${card.closingDay} · vence dia ${card.dueDay}`}
        </ThemedText>
        {card.limit ? (
          <View style={styles.limit}>
            <View style={styles.track}>
              <AnimatedFill ratio={used / card.limit} color={overLimit ? '#FFD1D1' : WHITE} height={4} />
            </View>
            <ThemedText type="caption" style={styles.dim} numberOfLines={1}>
              {overLimit ? '! ' : ''}Limite usado {money(used)} de {money(card.limit)}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: Spacing.three, overflow: 'hidden', justifyContent: 'space-between' },
  white: { color: WHITE },
  dim: { color: DIM },
  shine: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)' },
  shineA: { width: 260, height: 260, top: -150, right: -70 },
  shineB: { width: 180, height: 180, bottom: -120, left: -50 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  edit: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chip: {
    width: 40,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#E9C46A',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLine: { position: 'absolute', left: 6, right: 6, height: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  chipLineV: { left: undefined, right: undefined, top: 5, bottom: 5, width: 1, height: undefined },
  bottom: { gap: 1 },
  limit: { gap: 4, marginTop: 6 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
});
