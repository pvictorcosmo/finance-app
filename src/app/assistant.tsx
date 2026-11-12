import { router, Stack } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AiError, DEFAULT_AI_MODEL, extractExpensesWithAi } from '@/ai/claude';
import { useHasApiKey } from '@/ai/key-store';
import { categoryIcon, Icon, IconBadge } from '@/components/icon';
import { Skeleton } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppRefreshControl, Button, Row } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatShort, relativeDays, todayISO } from '@/domain/dates';
import { formatBRL } from '@/domain/money';
import { keyToPayment, paymentLabel, paymentToKey } from '@/domain/payment';
import { draftParam, isComplete, parseQuickEntry, type ExpenseDraft } from '@/domain/quick-parse';
import { buildHistoryIndex, frequentEntries } from '@/domain/suggestions';
import { useTheme } from '@/hooks/use-theme';
import { useFinance, useFinanceData } from '@/store/finance-store';

type DraftStatus = 'saved' | 'pending' | 'discarded' | 'undone' | 'editing';

interface DraftItem {
  draft: ExpenseDraft;
  status: DraftStatus;
  savedId?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  drafts?: DraftItem[];
  loading?: boolean;
}

let seq = 0;
const nextId = () => `m${++seq}`;

/**
 * Chat-style quick entry: "10 reais dia a dia, tomada, cartão itaú" becomes an expense.
 * Local parsing runs first (offline, free); Claude is used when something is missing
 * and an API key is configured. Complete expenses are saved right away with an undo.
 */
export default function AssistantScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useFinanceData();
  const saveExpense = useFinance((s) => s.saveExpense);
  const deleteExpense = useFinance((s) => s.deleteExpense);
  const hasKey = useHasApiKey();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: nextId(),
      role: 'assistant',
      text:
        'Me diga o que você gastou, do seu jeito. Exemplos:\n' +
        '• 10 reais dia a dia, tomada, cartão itaú\n' +
        '• uber 23,90\n' +
        '• mercado 150 ontem pix\n' +
        '• celular 2400 em 10x nubank\n' +
        'Vários de uma vez: um por linha ou separados por ";".',
    },
  ]);

  const index = useMemo(() => buildHistoryIndex(data.expenses), [data.expenses]);
  const frequent = useMemo(() => frequentEntries(index, 6), [index]);
  const lastPaymentKey = data.expenses.at(-1) ? paymentToKey(data.expenses.at(-1)!.payment) : undefined;
  const model = data.settings.aiModel ?? DEFAULT_AI_MODEL;

  const update = (id: string, patch: (m: ChatMessage) => ChatMessage) =>
    setMessages((list) => list.map((m) => (m.id === id ? patch(m) : m)));

  const save = (d: ExpenseDraft): string =>
    saveExpense({
      description: d.description,
      amount: d.amount!,
      categoryId: d.categoryId!,
      date: d.date,
      payment: keyToPayment(d.paymentKey!),
      installments: d.installments,
    });

  /** Saves complete drafts right away; incomplete ones wait for the user. */
  const settle = (drafts: ExpenseDraft[]): DraftItem[] =>
    drafts.map((draft) =>
      isComplete(draft) ? { draft, status: 'saved', savedId: save(draft) } : { draft, status: 'pending' },
    );

  const send = async (raw: string = input) => {
    const text = raw.trim();
    if (!text) return;
    setInput('');
    const today = todayISO();
    const local = parseQuickEntry(text, {
      categories: data.categories,
      cards: data.cards,
      index,
      today,
      lastPaymentKey,
    });
    const needsAi = hasKey && (local.length === 0 || local.some((d) => !isComplete(d)));
    const replyId = nextId();
    setMessages((list) => [
      ...list,
      { id: nextId(), role: 'user', text },
      needsAi ? { id: replyId, role: 'assistant', loading: true } : { id: replyId, role: 'assistant', drafts: settle(local) },
    ]);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    if (!needsAi) return;

    try {
      const fromAi = await extractExpensesWithAi(text, {
        model,
        categories: data.categories,
        cards: data.cards,
        today,
      });
      // Fill what the AI did not know with the local guess (e.g., usual payment method).
      const merged = fromAi.map((d, i) => ({
        ...d,
        paymentKey: d.paymentKey ?? local[i]?.paymentKey ?? lastPaymentKey,
        guessed: d.paymentKey ? {} : { payment: 'last' as const },
      }));
      update(replyId, (m) => ({ ...m, loading: false, drafts: settle(merged.length ? merged : local) }));
    } catch (error) {
      const reason = error instanceof AiError ? error.message : 'Erro ao usar a IA.';
      update(replyId, (m) => ({
        ...m,
        loading: false,
        text: `${reason} Usei a leitura automática:`,
        drafts: settle(local),
      }));
    }
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };

  const setStatus = (messageId: string, index: number, patch: Partial<DraftItem>) =>
    update(messageId, (m) => ({
      ...m,
      drafts: m.drafts?.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    }));

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: 'Assistente' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<AppRefreshControl />}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
          {hasKey === false ? (
            <Pressable onPress={() => router.navigate('/plan')}>
              <ThemedText type="caption" style={[styles.notice, { backgroundColor: theme.primarySoft, color: theme.accent }]}>
                ✨ Funciona sem IA para frases simples. Para frases livres, configure sua chave do Claude em Planejar →
                Inteligência artificial.
              </ThemedText>
            </Pressable>
          ) : null}
          {messages.map((m) => (
            <View key={m.id} style={[styles.bubbleRow, m.role === 'user' && styles.bubbleRowUser]}>
              <View
                style={[
                  styles.bubble,
                  m.role === 'user'
                    ? { backgroundColor: theme.primary }
                    : { backgroundColor: theme.backgroundElement },
                ]}>
                {m.loading ? (
                  // Placeholder shaped like the expense card that is on its way.
                  <View style={styles.thinking} accessible accessibilityLabel="Entendendo sua mensagem">
                    <ThemedText type="caption" themeColor="textSecondary">
                      ✨ Entendendo…
                    </ThemedText>
                    <Row style={styles.thinkingRow}>
                      <Skeleton width={40} height={40} radius={20} />
                      <View style={styles.thinkingLines}>
                        <Skeleton width="70%" />
                        <Skeleton width="45%" height={12} />
                      </View>
                    </Row>
                  </View>
                ) : null}
                {m.text ? (
                  <ThemedText type="small" style={m.role === 'user' ? { color: theme.onPrimary } : undefined}>
                    {m.text}
                  </ThemedText>
                ) : null}
                {m.drafts?.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Não encontrei nenhum valor. Tente algo como &quot;uber 25 nubank&quot;.
                  </ThemedText>
                ) : null}
                {m.drafts?.map((item, i) => (
                  <DraftCard
                    key={i}
                    item={item}
                    onUndo={() => {
                      if (item.savedId) deleteExpense(item.savedId);
                      setStatus(m.id, i, { status: 'undone' });
                    }}
                    onDiscard={() => setStatus(m.id, i, { status: 'discarded' })}
                    onComplete={() => {
                      setStatus(m.id, i, { status: 'editing' });
                      router.push({ pathname: '/expense', params: { draft: draftParam(item.draft) } });
                    }}
                    onSaveAnyway={() => {
                      if (isComplete(item.draft)) setStatus(m.id, i, { status: 'saved', savedId: save(item.draft) });
                    }}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        {frequent.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick}>
            {frequent.map((f) => (
              <Pressable
                key={f.description}
                onPress={() => setInput(`${f.description} ${(f.lastAmount / 100).toFixed(2).replace('.', ',')}`)}
                style={({ pressed }) => [
                  styles.quickChip,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="caption">
                  {f.description} · {formatBRL(f.lastAmount)}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Row
          style={[
            styles.inputBar,
            { paddingBottom: insets.bottom + Spacing.two, borderTopColor: theme.border, backgroundColor: theme.background },
          ]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ex.: 10 reais dia a dia, tomada, cartão itaú"
            placeholderTextColor={theme.textSecondary}
            multiline
            autoFocus
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
            onSubmitEditing={() => send()}
            submitBehavior="submit"
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            onPress={() => send()}
            disabled={!input.trim()}
            style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: input.trim() ? 1 : 0.4 }]}>
            <Icon name="send" size={20} color={theme.onPrimary} />
          </Pressable>
        </Row>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/** One parsed expense inside an assistant bubble. */
function DraftCard({
  item,
  onUndo,
  onDiscard,
  onComplete,
  onSaveAnyway,
}: {
  item: DraftItem;
  onUndo: () => void;
  onDiscard: () => void;
  onComplete: () => void;
  onSaveAnyway: () => void;
}) {
  const theme = useTheme();
  const categories = useFinance((s) => s.categories);
  const cards = useFinance((s) => s.cards);
  const { draft, status } = item;
  const category = categories.find((c) => c.id === draft.categoryId);
  const missing = [
    draft.amount ? null : 'valor',
    category ? null : 'categoria',
    draft.paymentKey ? null : 'pagamento',
  ].filter(Boolean);
  const faded = status === 'undone' || status === 'discarded';

  return (
    <View style={[styles.draft, { borderColor: theme.border, opacity: faded ? 0.5 : 1 }]}>
      <Row>
        <IconBadge name={category ? categoryIcon(category) : 'tag'} color={category?.color ?? theme.textSecondary} size={36} />
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {draft.description}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
            {[
              category?.name ?? '— categoria?',
              draft.paymentKey ? paymentLabel(keyToPayment(draft.paymentKey), cards) : '— pagamento?',
              draft.installments > 1 ? `${draft.installments}x` : null,
              draft.date === todayISO() ? 'hoje' : `${formatShort(draft.date)} (${relativeDays(draft.date)})`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </View>
        <ThemedText type="smallBold">{draft.amount ? formatBRL(draft.amount) : 'R$ ?'}</ThemedText>
      </Row>

      {draft.guessed.category === 'history' || draft.guessed.payment ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {draft.guessed.category === 'history' ? 'Categoria pelo seu histórico. ' : ''}
          {draft.guessed.payment === 'history'
            ? 'Pagamento que você costuma usar.'
            : draft.guessed.payment === 'last'
              ? 'Pagamento do último gasto.'
              : ''}
        </ThemedText>
      ) : null}

      {status === 'saved' ? (
        <Row style={styles.between}>
          <ThemedText type="caption" style={{ color: theme.success, fontWeight: 600 }}>
            ✓ Lançado
          </ThemedText>
          <Button label="Desfazer" icon="undo" variant="ghost" compact onPress={onUndo} />
        </Row>
      ) : status === 'undone' ? (
        <ThemedText type="caption" themeColor="textSecondary">
          Desfeito.
        </ThemedText>
      ) : status === 'discarded' ? (
        <ThemedText type="caption" themeColor="textSecondary">
          Descartado.
        </ThemedText>
      ) : status === 'editing' ? (
        <ThemedText type="caption" themeColor="textSecondary">
          Aberto no formulário.
        </ThemedText>
      ) : (
        <>
          {missing.length ? (
            <ThemedText type="caption" style={{ color: theme.warning }}>
              ! Falta: {missing.join(', ')}
            </ThemedText>
          ) : null}
          <Row style={styles.actions}>
            <Button label="Completar" icon="edit" variant="secondary" compact onPress={onComplete} />
            {!missing.length ? <Button label="Lançar" compact onPress={onSaveAnyway} /> : null}
            <Button label="Descartar" variant="ghost" compact onPress={onDiscard} />
          </Row>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thinking: { gap: 10, minWidth: 220 },
  thinkingRow: { gap: 12 },
  thinkingLines: { flex: 1, gap: 8 },
  flex: { flex: 1 },
  messages: {
    padding: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  notice: { borderRadius: 14, padding: Spacing.three, overflow: 'hidden' },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '88%', borderRadius: 20, padding: 12, gap: Spacing.two },
  draft: { borderWidth: 1, borderRadius: 16, padding: 10, gap: 6, minWidth: 260 },
  between: { justifyContent: 'space-between' },
  actions: { flexWrap: 'wrap', gap: 4 },
  quick: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.two },
  quickChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  pressed: { opacity: 0.6 },
  inputBar: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
