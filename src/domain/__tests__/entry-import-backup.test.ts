import { backupFileName, parseBackup, serializeBackup } from '../backup';
import { buildImportRows, defaultImportPayment, setRowCategory } from '../import-plan';
import { draftParam, parseQuickEntry, readDraftParam } from '../quick-parse';
import { parseSignedAmount, parseStatement, splitExpenses } from '../statement';
import { autocomplete, buildHistoryIndex, suggestByKeywords } from '../suggestions';
import { buildDailySummary } from '../summary';
import { decodeBytes, merchantKey } from '../text';
import { makeCard, makeCategory, makeData, makeExpense, makeReceivable } from '@/test-utils/factories';

const categories = [
  makeCategory({ id: 'dia', name: 'Dia a dia' }),
  makeCategory({ id: 'lazer', name: 'Lazer' }),
  makeCategory({ id: 'almoco', name: 'Almoço' }),
  makeCategory({ id: 'uber', name: 'Uber' }),
];
const cards = [makeCard({ id: 'itau', name: 'Itaú' }), makeCard({ id: 'nu', name: 'Nubank' })];
const history = [
  makeExpense({ id: '1', description: 'Uber', amount: 2000, date: '2026-10-01', categoryId: 'uber', payment: { kind: 'credit', cardId: 'nu' } }),
  makeExpense({ id: '2', description: 'Uber', amount: 2500, date: '2026-10-05', categoryId: 'uber', payment: { kind: 'credit', cardId: 'nu' } }),
  makeExpense({ id: '3', description: 'Padaria Pão Quente', amount: 1500, date: '2026-10-05', categoryId: 'dia' }),
];
const index = buildHistoryIndex(history);

describe('quick entry parsing', () => {
  const ctx = { categories, cards, index, today: '2026-11-04', lastPaymentKey: 'debit' };
  const parse = (text: string) =>
    parseQuickEntry(text, ctx).map((d) => [d.amount, d.description, d.categoryId, d.paymentKey, d.date, d.installments]);

  it('understands the example from the user', () => {
    expect(parse('10 reais dia a dia, tomada, cartao itau')).toEqual([[1000, 'Tomada', 'dia', 'credit:itau', '2026-11-04', 1]]);
  });

  it('keeps decimal commas and learns the usual card', () => {
    expect(parse('uber 23,90')).toEqual([[2390, 'Uber', 'uber', 'credit:nu', '2026-11-04', 1]]);
  });

  it('prefers the money-looking number', () => {
    expect(parse('99 pop 15,90 pix lazer')).toEqual([[1590, '99 pop', 'lazer', 'pix', '2026-11-04', 1]]);
  });

  it('reads dates, installments and keywords', () => {
    expect(parse('mercado 150 ontem pix')).toEqual([[15000, 'Mercado', 'dia', 'pix', '2026-11-03', 1]]);
    expect(parse('celular 2400 em 10x itau')).toEqual([[240000, 'Celular', undefined, 'credit:itau', '2026-11-04', 10]]);
    expect(parse('R$ 45 almoço dia 2 nubank')).toEqual([[4500, 'Almoço', 'almoco', 'credit:nu', '2026-11-02', 1]]);
  });

  it('splits several expenses by line or semicolon', () => {
    expect(parse('cinema 60; ifood 42,50 nubank')).toHaveLength(2);
  });

  it('round-trips drafts through the route param', () => {
    const [draft] = parseQuickEntry('uber 23,90', ctx);
    expect(readDraftParam(draftParam(draft))).toMatchObject({ amount: 2390, categoryId: 'uber', paymentKey: 'credit:nu' });
    expect(readDraftParam('not json')).toBeNull();
  });
});

describe('suggestions', () => {
  it('normalizes merchant names from statements', () => {
    expect(merchantKey('UBER *TRIP HELP.UBER.COM 1234')).toBe('uber trip help');
  });

  it('maps keywords to the user categories', () => {
    expect(suggestByKeywords('IFD*RESTAURANTE SABOR', categories)).toBe('almoco');
    expect(suggestByKeywords('Netflix.com', categories)).toBe('lazer');
    expect(suggestByKeywords('xpto', categories)).toBeUndefined();
  });

  it('autocompletes descriptions already used', () => {
    expect(autocomplete(index, 'pad').map((e) => e.description)).toEqual(['Padaria Pão Quente']);
  });
});

describe('text decoding', () => {
  it('decodes UTF-8 and falls back to Latin-1', () => {
    expect(decodeBytes(new Uint8Array([0x41, 0xc3, 0xa7, 0xc3, 0xa3, 0x6f]))).toBe('Ação');
    expect(decodeBytes(new Uint8Array([0x41, 0x6c, 0x6d, 0x6f, 0xe7, 0x6f]))).toBe('Almoço');
  });
});

describe('bank statements', () => {
  const files: Record<string, { text: string; expected: [string, string, number][]; bank?: string; kind: string }> = {
    'Nubank bill (CSV)': {
      text: 'date,title,amount\n2026-10-05,Uber *Trip,23.90\n2026-10-10,Pagamento recebido,-500.00\n2026-10-12,Netflix.Com,55.90',
      expected: [['2026-10-05', 'Uber *Trip', 2390], ['2026-10-12', 'Netflix.Com', 5590]],
      bank: 'Nubank',
      kind: 'card',
    },
    'Nubank account (CSV)': {
      text: 'Data,Valor,Identificador,Descrição\n05/10/2026,-23.90,abc,Compra no débito - Padaria\n06/10/2026,1500.00,def,Pix recebido',
      expected: [['2026-10-05', 'Compra no débito - Padaria', 2390]],
      bank: 'Nubank',
      kind: 'account',
    },
    'Itaú (CSV)': {
      text: 'data;lançamento;ag./origem;valor (R$);saldos (R$)\n05/10/2026;SALDO ANTERIOR;;;1.000,00\n07/10/2026;UBER   *TRIP;;-23,90;\n08/10/2026;TED RECEBIDA;;2.000,00;',
      expected: [['2026-10-07', 'UBER   *TRIP', 2390]],
      kind: 'unknown',
    },
    'Inter (CSV with preamble)': {
      text: 'Extrato Conta Corrente\nConta ;12345\n\nData Lançamento;Histórico;Descrição;Valor;Saldo\n05/10/2026;Compra no debito;UBER TRIP;-23,90;976,10\n07/10/2026;Pix recebido;Fulano;300,00;1.276,10',
      expected: [['2026-10-05', 'UBER TRIP', 2390]],
      kind: 'unknown',
    },
    'Banco do Brasil (CSV with Entrada/Saída)': {
      text: '"Data","Lançamento","Detalhes","N° documento","Valor","Tipo Lançamento"\n"05/10/2026","Saldo Anterior","","","1000,00","Entrada"\n"07/10/2026","Compra com Cartão","UBER TRIP","124","23,90","Saída"\n"08/10/2026","Pix - Recebido","Fulano","125","80,00","Entrada"',
      expected: [['2026-10-07', 'Compra com Cartão UBER TRIP', 2390]],
      kind: 'unknown',
    },
    'Itaú (OFX)': {
      text: 'OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTRS><BANKACCTFROM><BANKID>0341</BANKACCTFROM><BANKTRANLIST>\n<STMTTRN><DTPOSTED>20261005120000[-3:BRT]<TRNAMT>-23.90<FITID>A1<MEMO>UBER *TRIP</STMTTRN>\n<STMTTRN><DTPOSTED>20261006<TRNAMT>2000.00<FITID>A2<MEMO>SALARIO</STMTTRN>\n</BANKTRANLIST></STMTRS></BANKMSGSRSV1></OFX>',
      expected: [['2026-10-05', 'UBER *TRIP', 2390]],
      bank: 'Itaú',
      kind: 'account',
    },
  };

  it.each(Object.entries(files))('reads %s', (_name, file) => {
    const parsed = parseStatement(file.text);
    expect(parsed.kind).toBe(file.kind);
    expect(parsed.bank).toBe(file.bank);
    expect(splitExpenses(parsed.rows).expenses.map((e) => [e.date, e.description, e.value])).toEqual(file.expected);
  });

  it.each([
    ['-1.234,56', -123456],
    ['1.234,56 D', -123456],
    ['(10,00)', -1000],
    ['R$ 10,00', 1000],
    ['10,00-', -1000],
  ])('parses signed amount %p', (input, cents) => {
    expect(parseSignedAmount(input)).toBe(cents);
  });
});

describe('import review', () => {
  const candidates = [
    { date: '2026-10-05', description: 'UBER *TRIP 123', amount: -2390, value: 2390 },
    { date: '2026-10-06', description: 'UBER *TRIP 456', amount: -1500, value: 1500 },
    { date: '2026-10-07', description: 'LOJA XPTO', amount: -5000, value: 5000 },
  ];
  const existing = [makeExpense({ id: 'old', description: 'Uber *trip 123', amount: 2390, date: '2026-10-05', categoryId: 'uber' })];

  it('detects duplicates and pre-fills categories', () => {
    const rows = buildImportRows(candidates, existing, categories, buildHistoryIndex(existing));
    expect(rows.map((r) => [r.duplicate, r.include, r.categoryId, r.categorySource])).toEqual([
      [true, false, 'uber', 'history'],
      [false, true, 'uber', 'history'],
      [false, true, undefined, undefined],
    ]);
  });

  it('applies a manual category to similar rows', () => {
    const rows = buildImportRows(candidates, [], categories, buildHistoryIndex([]));
    const updated = setRowCategory(rows, rows[0].key, 'lazer');
    expect(updated.map((r) => r.categoryId)).toEqual(['lazer', 'lazer', undefined]);
  });

  it('suggests the payment from the file type and bank', () => {
    expect(defaultImportPayment({ kind: 'card', bank: 'Nubank' }, cards)).toBe('credit:nu');
    expect(defaultImportPayment({ kind: 'account', bank: 'Itaú' }, cards)).toBe('debit');
  });
});

describe('backup', () => {
  const data = makeData({
    settings: { salary: 500000, cycleStartDay: 5, startedAt: '2026-08-01' },
    categories,
    cards,
    expenses: history,
    receivables: [makeReceivable({ id: 'r', person: 'Ana', amount: 30000, firstDue: '2026-10-20' })],
  });

  it('round-trips all data', () => {
    const result = parseBackup(serializeBackup(data, '2026-11-04T12:00:00.000Z'));
    expect(result.ok && result.data).toEqual(data);
    expect(result.ok && result.summary).toEqual({
      exportedAt: '2026-11-04T12:00:00.000Z',
      expenses: 3,
      cards: 2,
      categories: 4,
      people: 1,
    });
  });

  it('migrates old backups', () => {
    const v1 = JSON.stringify({
      format: 'finance-app-backup',
      version: 1,
      exportedAt: '2026-08-01',
      data: { settings: { salary: 1, cycleStartDay: 1 }, categories: [{ id: 'x', color: '#208AEF' }], cards: [], expenses: [], fixedBills: [] },
    });
    const result = parseBackup(v1);
    expect(result.ok && [result.data.categories[0].color, result.data.agreements]).toEqual(['#2a78d6', []]);
  });

  it('rejects files that are not backups', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('{"a":1}').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: 'finance-app-backup', version: 99, data: {} })).ok).toBe(false);
  });

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 10, 4))).toBe('finance-backup-2026-11-04.json');
  });
});

describe('daily summary', () => {
  it('lists categories by severity and what is due', () => {
    const data = makeData({
      settings: { salary: 500000, cycleStartDay: 1, startedAt: '2026-08-01' },
      categories: [
        makeCategory({ id: 'd', name: 'Dia a dia', limitValue: 160000 }),
        makeCategory({ id: 'u', name: 'Uber', limitValue: 25000 }),
      ],
      expenses: [
        makeExpense({ id: 'm', amount: 56450, date: '2026-11-02', categoryId: 'd' }),
        makeExpense({ id: 'u1', amount: 27400, date: '2026-11-03', categoryId: 'u' }),
      ],
      receivables: [makeReceivable({ id: 'r', person: 'Bruno', amount: 8500, firstDue: '2026-11-04' })],
    });
    const summary = buildDailySummary(data, '2026-11-04');
    expect(summary.title).toBe('💰 R$ 4.162 livres no mês · faltam 27 dias');
    expect(summary.body.split('\n')).toEqual([
      '🔴 Uber: R$ 274/R$ 250 · estourou R$ 24',
      '🟡 Dia a dia: R$ 565/R$ 1.600 · acima do ritmo',
      '🤝 Acertos hoje: Bruno R$ 85',
    ]);
  });
});
