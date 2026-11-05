import Anthropic from '@anthropic-ai/sdk';

import type { PaymentKey } from '@/domain/payment';
import type { ExpenseDraft } from '@/domain/quick-parse';
import type { AiModel, Category, Cents, CreditCard, ID, ISODate } from '@/domain/types';

import { getApiKey } from './key-store';

/** Default model: the current Opus. Haiku is offered in settings as the cheaper option. */
export const DEFAULT_AI_MODEL: AiModel = 'claude-opus-5-5';

export const AI_MODELS: { value: AiModel; label: string; hint: string }[] = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Mais preciso (padrão)' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'Bem mais barato, ótimo para essa tarefa' },
];

/** Error with a message ready to show to the user (pt-BR). */
export class AiError extends Error {}

/**
 * Builds the SDK client with the user's own key.
 * `dangerouslyAllowBrowser` is required on web; the key belongs to the user and stays on their device.
 * @throws {AiError} When no key is configured.
 */
async function getClient(): Promise<Anthropic> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new AiError('Configure sua chave da API do Claude em Planejar → Inteligência artificial.');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 60_000 });
}

/**
 * Sends one request with a JSON-schema constrained answer and returns the parsed JSON.
 * Uses low effort (extraction/classification) and, on Opus, server-side refusal fallbacks.
 * @param model Claude model id.
 * @param system Stable instructions.
 * @param user Per-request content.
 * @param schema JSON schema the answer must follow.
 * @param maxTokens Output cap.
 * @throws {AiError} With a user-facing message on any failure.
 */
async function requestJson<T>(
  model: AiModel,
  system: string,
  user: string,
  schema: Record<string, unknown>,
  maxTokens = 4000,
): Promise<T> {
  const client = await getClient();
  const base = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user' as const, content: user }],
    output_config: { effort: 'low' as const, format: { type: 'json_schema' as const, schema } },
  };
  let response: Anthropic.Beta.BetaMessage;
  try {
    response =
      model === 'claude-opus-5-5'
        ? await client.beta.messages.create({
            ...base,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
          })
        : await client.beta.messages.create(base);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AiError('Chave da API inválida. Confira em Planejar.');
    if (error instanceof Anthropic.PermissionDeniedError) throw new AiError('Sua chave não tem permissão para este modelo.');
    if (error instanceof Anthropic.RateLimitError) throw new AiError('Muitas requisições agora. Tente de novo em instantes.');
    if (error instanceof Anthropic.APIConnectionError) throw new AiError('Sem conexão com a internet.');
    if (error instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${error.status ?? '?'}). Tente de novo.`);
    throw new AiError('Não foi possível falar com a IA.');
  }

  if (response.stop_reason === 'refusal') throw new AiError('A IA não conseguiu processar este pedido.');
  if (response.stop_reason === 'max_tokens') throw new AiError('Texto grande demais para processar de uma vez.');
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
  if (!text) throw new AiError('A IA não retornou uma resposta.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError('Resposta da IA em formato inesperado.');
  }
}

/** Context the model needs to map words to the user's own categories and cards. */
export interface AiContext {
  model: AiModel;
  categories: Pick<Category, 'id' | 'name'>[];
  cards: Pick<CreditCard, 'id' | 'name'>[];
  today: ISODate;
}

function paymentChoices(cards: AiContext['cards']): { key: PaymentKey; label: string }[] {
  return [
    ...cards.map((c) => ({ key: `credit:${c.id}`, label: `cartão de crédito ${c.name}` })),
    { key: 'debit', label: 'débito' },
    { key: 'pix', label: 'Pix' },
    { key: 'cash', label: 'dinheiro' },
  ];
}

const EXTRACT_SYSTEM = `Você extrai gastos de mensagens curtas em português do Brasil para um app de controle financeiro.
Regras:
- Cada gasto citado vira um item. Valores em centavos (R$ 10 = 1000; "10,50" = 1050).
- category_id: o id da categoria da lista que melhor combina. Se o usuário citar a categoria pelo nome, use-a. Se não der para saber, "".
- payment: uma das chaves da lista de pagamentos. "itau", "cartão itaú", "no nubank" = cartão de crédito com esse nome. Se não for dito, "".
- date: AAAA-MM-DD. "hoje" = data de hoje; "ontem" = dia anterior; "dia 5" = dia 5 do mês atual (ou do anterior se ainda não chegou). Se não for dito, "".
- installments: número de parcelas ("em 10x" = 10); padrão 1.
- description: o que foi comprado, curto e com inicial maiúscula (ex.: "Tomada"). Não repita valor, categoria nem forma de pagamento.`;

/**
 * Turns a free-text message into expense drafts using Claude.
 * @param text What the user typed (may contain several expenses).
 * @param ctx Categories, cards, model and today's date.
 * @returns Drafts ready for review; unknown fields are left undefined.
 */
export async function extractExpensesWithAi(text: string, ctx: AiContext): Promise<ExpenseDraft[]> {
  const payments = paymentChoices(ctx.cards);
  const schema = {
    type: 'object',
    properties: {
      expenses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            amount_cents: { type: 'integer' },
            description: { type: 'string' },
            category_id: { type: 'string', enum: [...ctx.categories.map((c) => c.id), ''] },
            payment: { type: 'string', enum: [...payments.map((p) => p.key), ''] },
            date: { type: 'string' },
            installments: { type: 'integer' },
          },
          required: ['amount_cents', 'description', 'category_id', 'payment', 'date', 'installments'],
          additionalProperties: false,
        },
      },
    },
    required: ['expenses'],
    additionalProperties: false,
  };
  const user = [
    `Hoje: ${ctx.today}`,
    `Categorias: ${ctx.categories.map((c) => `${c.id} = ${c.name}`).join('; ')}`,
    `Pagamentos: ${payments.map((p) => `${p.key} = ${p.label}`).join('; ')}`,
    `Mensagem: ${text}`,
  ].join('\n');

  const result = await requestJson<{
    expenses: {
      amount_cents: number;
      description: string;
      category_id: string;
      payment: string;
      date: string;
      installments: number;
    }[];
  }>(ctx.model, EXTRACT_SYSTEM, user, schema, 2000);

  return result.expenses.map((e) => {
    const paymentKey = e.payment || undefined;
    return {
      amount: e.amount_cents > 0 ? e.amount_cents : undefined,
      description: e.description.trim() || 'Gasto',
      categoryId: e.category_id || undefined,
      paymentKey,
      date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : ctx.today,
      installments: paymentKey?.startsWith('credit:') ? Math.max(1, e.installments || 1) : 1,
      guessed: {},
    };
  });
}

const CATEGORIZE_SYSTEM = `Você categoriza lançamentos de extrato bancário/fatura de cartão brasileiros para um app de finanças pessoais.
Para cada lançamento:
- category_id: o id da categoria do usuário que melhor combina com o tipo de gasto (ex.: Uber/99 = transporte; iFood/restaurante = alimentação; mercado/farmácia = dia a dia; cinema/bar/streaming = lazer). Se nenhuma combinar, "".
- clean_description: nome curto e legível do estabelecimento (ex.: "UBER *TRIP HELP.UBER.COM" -> "Uber"; "PAG*JOSEDASILVA" -> "José da Silva"; "IFD*RESTAURANTE SABOR" -> "iFood - Restaurante Sabor").`;

export interface CategorizeItem {
  id: string;
  description: string;
  amount: Cents;
}

export interface CategorizeResult {
  categoryId?: ID;
  cleanDescription: string;
}

/** Items per request, so each answer stays well under the output cap. */
const BATCH = 60;

/**
 * Suggests a category (and a cleaner name) for each imported statement line.
 * @param items Lines to classify.
 * @param ctx Categories and model.
 * @returns Map from item id to its suggestion.
 */
export async function categorizeWithAi(
  items: CategorizeItem[],
  ctx: Pick<AiContext, 'model' | 'categories'>,
): Promise<Map<string, CategorizeResult>> {
  const out = new Map<string, CategorizeResult>();
  const schema = {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            category_id: { type: 'string', enum: [...ctx.categories.map((c) => c.id), ''] },
            clean_description: { type: 'string' },
          },
          required: ['id', 'category_id', 'clean_description'],
          additionalProperties: false,
        },
      },
    },
    required: ['results'],
    additionalProperties: false,
  };
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const user = [
      `Categorias: ${ctx.categories.map((c) => `${c.id} = ${c.name}`).join('; ')}`,
      'Lançamentos (id | descrição | valor):',
      ...chunk.map((it) => `${it.id} | ${it.description} | R$ ${(it.amount / 100).toFixed(2)}`),
    ].join('\n');
    const result = await requestJson<{ results: { id: string; category_id: string; clean_description: string }[] }>(
      ctx.model,
      CATEGORIZE_SYSTEM,
      user,
      schema,
      8000,
    );
    for (const r of result.results) {
      out.set(r.id, { categoryId: r.category_id || undefined, cleanDescription: r.clean_description.trim() });
    }
  }
  return out;
}

/**
 * Cheap round trip to validate the key and model.
 * @throws {AiError} When the key or model does not work.
 */
export async function testAiConnection(model: AiModel): Promise<void> {
  await requestJson<{ ok: boolean }>(
    model,
    'Responda apenas com o JSON pedido.',
    'Responda ok = true.',
    { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
    200,
  );
}
