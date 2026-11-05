import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AI_MODELS, AiError, DEFAULT_AI_MODEL, testAiConnection } from '@/ai/claude';
import { getApiKey, maskKey, setApiKey, useHasApiKey } from '@/ai/key-store';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, Field, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { AiModel } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { useFinance } from '@/store/finance-store';

/**
 * "Artificial intelligence" section of the Plan tab: API key (kept in secure
 * storage), model choice and a connection test.
 */
export function AiSettings() {
  const theme = useTheme();
  const hasKey = useHasApiKey();
  const model = useFinance((s) => s.settings.aiModel) ?? DEFAULT_AI_MODEL;
  const setAiModel = useFinance((s) => s.setAiModel);
  const [masked, setMasked] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let alive = true;
    getApiKey().then((k) => alive && setMasked(k ? maskKey(k) : null));
    return () => {
      alive = false;
    };
  }, [hasKey]);

  const save = async () => {
    const key = draft.trim();
    if (!key.startsWith('sk-ant-')) {
      setStatus({ tone: 'error', text: 'A chave começa com "sk-ant-". Copie de console.anthropic.com → API Keys.' });
      return;
    }
    await setApiKey(key);
    setDraft('');
    setStatus({ tone: 'info', text: 'Chave salva no armazenamento seguro do celular.' });
  };

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      await testAiConnection(model);
      setStatus({ tone: 'ok', text: 'Tudo certo: a IA respondeu.' });
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof AiError ? error.message : 'Falha no teste.' });
    } finally {
      setTesting(false);
    }
  };

  const color = status?.tone === 'ok' ? theme.success : status?.tone === 'error' ? theme.danger : theme.textSecondary;

  return (
    <Card>
      <Row style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}>
          <Icon name="sparkles" size={18} color={theme.accent} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold">Inteligência artificial (Claude)</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {hasKey ? `Chave configurada: ${masked ?? '…'}` : 'Usada no assistente e para categorizar extratos'}
          </ThemedText>
        </View>
      </Row>

      {hasKey ? (
        <>
          <Chips
            label="Modelo"
            options={AI_MODELS.map((m) => ({ value: m.value, label: m.label }))}
            value={model}
            onChange={(m) => setAiModel(m as AiModel)}
          />
          <ThemedText type="caption" themeColor="textSecondary">
            {AI_MODELS.find((m) => m.value === model)?.hint}. O custo é por uso, cobrado na sua conta Anthropic.
          </ThemedText>
          <Row style={styles.buttons}>
            <View style={styles.flex}>
              <Button label={testing ? 'Testando…' : 'Testar'} icon="check" variant="secondary" compact onPress={test} disabled={testing} />
            </View>
            <View style={styles.flex}>
              <Button
                label="Remover chave"
                variant="danger"
                compact
                onPress={async () => {
                  await setApiKey(null);
                  setStatus({ tone: 'info', text: 'Chave removida.' });
                }}
              />
            </View>
          </Row>
        </>
      ) : (
        <>
          <ThemedText type="caption" themeColor="textSecondary">
            Sem chave, o app entende frases simples e categoriza pelo seu histórico. Com a chave, a IA entende frases livres
            e nomes de extrato. A chave fica só neste celular.
          </ThemedText>
          <Field
            label="Chave da API"
            value={draft}
            onChangeText={setDraft}
            placeholder="sk-ant-..."
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Row style={styles.buttons}>
            <View style={styles.flex}>
              <Button label="Salvar chave" icon="key" compact onPress={save} disabled={!draft.trim()} />
            </View>
            <View style={styles.flex}>
              <Button
                label="Criar chave"
                variant="ghost"
                compact
                onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}
              />
            </View>
          </Row>
        </>
      )}
      {status ? (
        <ThemedText type="caption" style={{ color }}>
          {status.text}
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
