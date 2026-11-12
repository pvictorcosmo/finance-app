import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Appear } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { Card, Row, toneColors } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { Insight, InsightTone } from '@/domain/insights';
import { useTheme } from '@/hooks/use-theme';

/** Icon per tone: state is never told by color alone. */
const TONE_ICON: Record<InsightTone, IconName> = {
  danger: 'warning',
  warning: 'clock',
  accent: 'chart',
  success: 'check',
};

/**
 * "Seu mês em poucas palavras": the sentences from `buildInsights`, each with an icon
 * in its tone. Renders nothing when there is nothing worth saying.
 */
export function InsightsCard({ insights }: { insights: Insight[] }) {
  const theme = useTheme();
  if (!insights.length) return null;
  return (
    <Card>
      <Row style={styles.header}>
        <Icon name="sparkles" size={16} color={theme.accent} />
        <ThemedText type="caption" themeColor="textSecondary">
          SEU MÊS EM POUCAS PALAVRAS
        </ThemedText>
      </Row>
      {insights.map((insight, i) => {
        const { fg, bg } = toneColors(theme, insight.tone);
        return (
          <Appear key={insight.id} index={i}>
            <Row style={styles.item}>
              <View style={[styles.icon, { backgroundColor: bg }]}>
                <Icon name={TONE_ICON[insight.tone]} size={16} color={fg} />
              </View>
              <ThemedText type="small" style={styles.flex}>
                {insight.text}
              </ThemedText>
            </Row>
          </Appear>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: 6 },
  item: { gap: Spacing.three, alignItems: 'flex-start', paddingVertical: 2 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
