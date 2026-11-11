import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AccountError, resetPassword, signIn, signOut, signUp } from '@/sync/account';
import { pushNow } from '@/sync/engine';
import { isCloudConfigured } from '@/sync/firebase';
import { usePendingCount, useSyncStore, type SyncStatus } from '@/sync/sync-store';

const STATUS_LABEL: Record<SyncStatus, string> = {
  off: 'Desligada',
  connecting: 'Conectando…',
  syncing: 'Sincronizando…',
  synced: 'Sincronizado',
  offline: 'Sem internet: as mudanças ficam guardadas e sobem depois',
  error: 'Erro ao sincronizar',
};

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * "Account and cloud" section of the Plan tab: sign in once (the session is kept on
 * the device), see the sync status and force a sync.
 */
export function CloudSyncSettings() {
  const theme = useTheme();
  const email = useSyncStore((s) => s.email);
  const status = useSyncStore((s) => s.status);
  const error = useSyncStore((s) => s.error);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const pending = usePendingCount();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState<'in' | 'up' | 'reset' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (kind: 'in' | 'up' | 'reset') => {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === 'in') await signIn(form.email, form.password);
      else if (kind === 'up') await signUp(form.email, form.password);
      else {
        await resetPassword(form.email);
        setMessage({ ok: true, text: 'Enviamos um e-mail para você criar uma nova senha.' });
      }
      if (kind !== 'reset') setForm({ email: '', password: '' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof AccountError ? e.message : 'Não foi possível concluir.' });
    } finally {
      setBusy(null);
    }
  };

  const confirmSignOut = () =>
    Alert.alert(
      'Sair da conta?',
      'Seus dados continuam neste celular, mas param de sincronizar até você entrar de novo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => void signOut() },
      ],
    );

  const statusColor = status === 'error' ? theme.danger : status === 'synced' ? theme.success : theme.textSecondary;

  return (
    <Card>
      <Row style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}>
          <Icon name="person" size={18} color={theme.accent} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold">Conta e nuvem</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {email ?? 'Seus dados salvos na nuvem, em qualquer versão ou celular'}
          </ThemedText>
        </View>
      </Row>

      {!isCloudConfigured ? (
        <ThemedText type="caption" themeColor="textSecondary">
          A sincronização ainda não foi ativada neste app. Seus dados continuam salvos neste celular.
        </ThemedText>
      ) : email ? (
        <>
          <ThemedText type="caption" style={{ color: statusColor }}>
            {status === 'error' && error ? error : STATUS_LABEL[status]}
            {status === 'synced' && lastSyncAt ? ` · ${formatTime(lastSyncAt)}` : ''}
          </ThemedText>
          {pending > 0 ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {pending} alteração(ões) aguardando envio.
            </ThemedText>
          ) : null}
          <Row style={styles.buttons}>
            <View style={styles.flex}>
              <Button label="Sincronizar agora" icon="repeat" variant="secondary" compact onPress={() => void pushNow()} />
            </View>
            <View style={styles.flex}>
              <Button label="Sair" variant="danger" compact onPress={confirmSignOut} />
            </View>
          </Row>
        </>
      ) : (
        <>
          <ThemedText type="caption" themeColor="textSecondary">
            Entre uma vez e o app fica conectado. Ao criar a conta, os dados deste celular vão para a nuvem.
          </ThemedText>
          <Field
            label="E-mail"
            value={form.email}
            onChangeText={(text) => setForm((f) => ({ ...f, email: text }))}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="voce@email.com"
          />
          <Field
            label="Senha"
            value={form.password}
            onChangeText={(text) => setForm((f) => ({ ...f, password: text }))}
            secureTextEntry
            autoComplete="password"
            placeholder="Mínimo de 6 caracteres"
          />
          <Row style={styles.buttons}>
            <View style={styles.flex}>
              <Button
                label={busy === 'in' ? 'Entrando…' : 'Entrar'}
                compact
                disabled={busy !== null || !form.email || !form.password}
                onPress={() => void run('in')}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label={busy === 'up' ? 'Criando…' : 'Criar conta'}
                variant="secondary"
                compact
                disabled={busy !== null || !form.email || !form.password}
                onPress={() => void run('up')}
              />
            </View>
          </Row>
          <Button
            label="Esqueci a senha"
            variant="ghost"
            compact
            disabled={busy !== null || !form.email}
            onPress={() => void run('reset')}
          />
        </>
      )}
      {message ? (
        <ThemedText type="caption" style={{ color: message.ok ? theme.success : theme.danger }}>
          {message.text}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: Spacing.three },
  iconBox: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttons: { gap: Spacing.two },
});
