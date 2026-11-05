import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { backupFileName, parseBackup, serializeBackup, type BackupSummary } from '@/domain/backup';
import { diffDays, todayISO } from '@/domain/dates';
import { useTheme } from '@/hooks/use-theme';
import { pickBackupFile, shareBackupFile } from '@/backup/backup-file';
import { useFinance, useFinanceData } from '@/store/finance-store';

/** Confirmação com botões (no web, Alert não tem botões; usa o confirm do navegador). */
function confirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'data desconhecida';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function describe(s: BackupSummary): string {
  return [
    `${s.expenses} gasto(s)`,
    `${s.cards} cartão(ões)`,
    `${s.categories} categoria(s)`,
    s.people ? `${s.people} pessoa(s) em Devedores` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Seção "Backup" da aba Planejar: exportar e importar todos os dados. */
export function BackupSettings() {
  const theme = useTheme();
  const data = useFinanceData();
  const markBackupExported = useFinance((s) => s.markBackupExported);
  const replaceAll = useFinance((s) => s.replaceAll);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const last = data.settings.lastBackupAt;
  const daysSince = last ? diffDays(last.slice(0, 10), todayISO()) : null;

  const exportBackup = async () => {
    setBusy('export');
    try {
      const now = new Date();
      const ok = await shareBackupFile(backupFileName(now), serializeBackup(data, now.toISOString()));
      if (ok) markBackupExported(now.toISOString());
      else notify('Não foi possível compartilhar', 'Este aparelho não permite compartilhar arquivos.');
    } catch (err) {
      notify('Erro ao exportar', String(err));
    } finally {
      setBusy(null);
    }
  };

  const importBackup = async () => {
    setBusy('import');
    try {
      const text = await pickBackupFile();
      if (text === null) return;
      const result = parseBackup(text);
      if (!result.ok) {
        notify('Backup inválido', result.error);
        return;
      }
      const ok = await confirm(
        'Substituir seus dados?',
        `Backup de ${formatStamp(result.summary.exportedAt)} com ${describe(result.summary)}.\n\n` +
          'Todos os dados atuais deste aparelho serão trocados pelos do backup. Isso não pode ser desfeito.',
        'Importar',
      );
      if (!ok) return;
      replaceAll(result.data);
      notify('Backup importado', 'Seus dados foram restaurados.');
    } catch (err) {
      notify('Erro ao importar', String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <Row style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}>
          <Icon name="savings" size={18} color={theme.accent} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold">Backup dos dados</ThemedText>
          <ThemedText
            type="caption"
            style={{ color: daysSince === null || daysSince > 30 ? theme.warning : theme.textSecondary }}>
            {last
              ? `Último backup: ${formatStamp(last)}${daysSince && daysSince > 30 ? ' · faça um novo' : ''}`
              : '! Você ainda não fez nenhum backup'}
          </ThemedText>
        </View>
      </Row>
      <ThemedText type="caption" themeColor="textSecondary">
        Gera um arquivo com tudo (gastos, cartões, categorias, devedores, histórico) para guardar no Drive, WhatsApp ou
        e-mail. Use para trocar de celular ou passar do Expo Go para o app instalado.
      </ThemedText>
      <Row style={styles.buttons}>
        <View style={styles.flex}>
          <Button
            label={busy === 'export' ? 'Gerando…' : 'Exportar backup'}
            icon="income"
            onPress={exportBackup}
            disabled={busy !== null}
            compact
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={busy === 'import' ? 'Abrindo…' : 'Importar backup'}
            icon="repeat"
            variant="secondary"
            onPress={importBackup}
            disabled={busy !== null}
            compact
          />
        </View>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: Spacing.three },
  iconBox: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttons: { gap: Spacing.two, marginTop: Spacing.one },
});
