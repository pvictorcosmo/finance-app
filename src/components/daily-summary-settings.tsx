import { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, DayStepper, Row } from '@/components/ui';
import { FEATURES } from '@/constants/features';
import { Spacing } from '@/constants/theme';
import { todayISO } from '@/domain/dates';
import { buildDailySummary } from '@/domain/summary';
import { useTheme } from '@/hooks/use-theme';
import {
  notificationsSupported,
  requestPermission,
  sendTestSummary,
  type PermissionResult,
} from '@/notifications/daily-summary';
import { DEFAULT_DAILY_SUMMARY, useFinance, useFinanceData } from '@/store/finance-store';

const MINUTES = ['0', '15', '30', '45'] as const;
const pad = (n: number) => String(n).padStart(2, '0');

/** Seção "Resumo diário" da aba Planejar: liga/desliga, horário, prévia e teste. */
export function DailySummarySettings() {
  const theme = useTheme();
  const data = useFinanceData();
  const setDailySummary = useFinance((s) => s.setDailySummary);
  const settings = { ...DEFAULT_DAILY_SUMMARY, ...data.settings.dailySummary };
  const [permission, setPermission] = useState<PermissionResult | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const preview = useMemo(() => buildDailySummary(data, todayISO(), { includePeople: FEATURES.receivables }), [data]);

  const toggle = async (on: boolean) => {
    if (!on) {
      setDailySummary({ enabled: false });
      return;
    }
    const result = await requestPermission();
    setPermission(result);
    if (result === 'granted') setDailySummary({ enabled: true });
    else askToOpenSettings();
  };

  const test = async (seconds: number | null) => {
    const result = await sendTestSummary(data, seconds);
    setPermission(result);
    if (result !== 'granted') askToOpenSettings();
    else setSent(seconds ? `Enviada! Saia do app: ela aparece em ${seconds} segundos.` : 'Enviada!');
  };

  const askToOpenSettings = () =>
    Alert.alert(
      'Notificações bloqueadas',
      'Permita as notificações do app nas configurações do celular para receber o resumo.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
      ],
    );

  return (
    <Card>
      <Row style={styles.header}>
        <View style={[styles.bell, { backgroundColor: theme.primarySoft }]}>
          <Icon name="bell" size={18} color={theme.accent} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold">Resumo diário</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {settings.enabled
              ? `Todo dia às ${pad(settings.hour)}:${pad(settings.minute)}`
              : 'Uma notificação por dia com seu mês e as categorias'}
          </ThemedText>
        </View>
        {notificationsSupported ? (
          <Switch
            value={settings.enabled}
            onValueChange={toggle}
            trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
            accessibilityLabel="Receber resumo diário"
          />
        ) : null}
      </Row>

      {!notificationsSupported ? (
        <ThemedText type="caption" themeColor="textSecondary">
          Disponível no app do celular (Android e iPhone).
        </ThemedText>
      ) : null}

      {settings.enabled ? (
        <>
          <DayStepper
            label="Horário"
            value={settings.hour}
            onChange={(hour) => setDailySummary({ hour })}
            min={0}
            max={23}
            format={(h) => `${pad(h)}:${pad(settings.minute)}`}
          />
          <Chips
            label="Minutos"
            options={MINUTES.map((m) => ({ value: m, label: `:${pad(Number(m))}` }))}
            value={String(settings.minute) as (typeof MINUTES)[number]}
            onChange={(m) => setDailySummary({ minute: Number(m) })}
          />
        </>
      ) : null}

      {permission === 'denied' ? (
        <ThemedText type="caption" style={{ color: theme.danger }}>
          ! Notificações bloqueadas para o app. Libere nas configurações do celular.
        </ThemedText>
      ) : null}

      {/* Prévia: como a notificação vai aparecer hoje */}
      <ThemedText type="caption" themeColor="textSecondary" style={styles.previewLabel}>
        PRÉVIA DE HOJE
      </ThemedText>
      <View style={[styles.preview, { backgroundColor: theme.backgroundSelected }]}>
        <Row style={styles.previewApp}>
          <View style={[styles.appDot, { backgroundColor: theme.primary }]} />
          <ThemedText type="caption" themeColor="textSecondary">
            finance-app · agora
          </ThemedText>
        </Row>
        <ThemedText type="smallBold">{preview.title}</ThemedText>
        <ThemedText type="caption" style={styles.previewBody}>
          {preview.body}
        </ThemedText>
      </View>

      {notificationsSupported ? (
        <>
          <Row style={styles.buttons}>
            <View style={styles.flex}>
              <Button label="Testar agora" icon="bell" variant="secondary" compact onPress={() => test(null)} />
            </View>
            <View style={styles.flex}>
              <Button label="Em 10 segundos" icon="clock" variant="secondary" compact onPress={() => test(10)} />
            </View>
          </Row>
          <ThemedText type="caption" themeColor={sent ? 'text' : 'textSecondary'}>
            {sent ?? 'Use "Em 10 segundos" e bloqueie a tela ou vá para a tela inicial para ver a notificação flutuando.'}
          </ThemedText>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: Spacing.three },
  bell: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  previewLabel: { textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.one },
  preview: { borderRadius: 18, padding: 14, gap: 4 },
  previewApp: { gap: 6, marginBottom: 2 },
  appDot: { width: 14, height: 14, borderRadius: 4 },
  previewBody: { lineHeight: 19 },
  buttons: { gap: Spacing.two },
});
