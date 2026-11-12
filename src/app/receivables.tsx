import { router } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Chips,
  Divider,
  EmptyState,
  Fab,
  Row,
  Screen,
  SectionHeader,
  StatTile,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { allAgreementOccurrences, isOpen, type AgreementOccurrence } from '@/domain/agreements';
import { formatShort, relativeDays, todayISO } from '@/domain/dates';
import { formatBRL } from '@/domain/money';
import { paymentLabel } from '@/domain/payment';
import {
  agreementHorizon,
  allReceivableInstallments,
  personSummaries,
  type ReceivableInstallment,
} from '@/domain/receivables';
import { useTheme } from '@/hooks/use-theme';
import { useFinance } from '@/store/finance-store';

type Filter = 'open' | 'received' | 'all';

/** Uma linha da lista de pagamentos: parcela de empréstimo ou mês de acordo. */
type Item =
  | { kind: 'loan'; key: string; person: string; date: string; inst: ReceivableInstallment }
  | { kind: 'agreement'; key: string; person: string; date: string; occ: AgreementOccurrence };

const personKey = (name: string) => name.trim().toLocaleLowerCase('pt-BR');

export default function ReceivablesScreen() {
  const theme = useTheme();
  const receivables = useFinance((s) => s.receivables);
  const agreements = useFinance((s) => s.agreements);
  const cards = useFinance((s) => s.cards);
  const toggleReceived = useFinance((s) => s.toggleReceived);
  const toggleAgreementSettled = useFinance((s) => s.toggleAgreementSettled);
  const today = todayISO();
  const [filter, setFilter] = useState<Filter>('open');
  const [person, setPerson] = useState<string | null>(null);

  const people = useMemo(() => personSummaries(receivables, agreements, today), [receivables, agreements, today]);

  const items = useMemo((): Item[] => {
    const loans: Item[] = allReceivableInstallments(receivables, today).map((inst) => ({
      kind: 'loan',
      key: `${inst.receivable.id}-${inst.index}`,
      person: inst.receivable.person,
      date: inst.due,
      inst,
    }));
    const months: Item[] = allAgreementOccurrences(agreements, agreementHorizon(today), today).map((occ) => ({
      kind: 'agreement',
      key: `${occ.agreement.id}@${occ.date}`,
      person: occ.agreement.person,
      date: occ.date,
      occ,
    }));
    return [...loans, ...months];
  }, [receivables, agreements, today]);

  const totals = people.reduce(
    (acc, p) => ({
      toReceive: acc.toReceive + Math.max(0, p.open),
      iOwe: acc.iOwe + Math.max(0, -p.open),
      overdue: acc.overdue + Math.max(0, p.overdue),
      received: acc.received + p.received,
    }),
    { toReceive: 0, iOwe: 0, overdue: 0, received: 0 },
  );

  const done = (i: Item) =>
    i.kind === 'loan' ? i.inst.status === 'received' : !isOpen(i.occ);
  const visible = items
    .filter((i) => person === null || personKey(i.person) === person)
    .filter((i) => filter === 'all' || (filter === 'received' ? done(i) : !done(i)))
    .sort((a, b) => (filter === 'received' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));

  const addButtons = (
    <Row style={styles.addRow}>
      <Button label="Devedor" icon="add" variant="secondary" compact onPress={() => router.push('/receivable')} />
      <Button label="Acordo mensal" icon="repeat" variant="secondary" compact onPress={() => router.push('/agreement')} />
    </Row>
  );

  return (
    <Screen
      title="Devedores"
      onBack={() => router.back()}
      subtitle="Quem te deve, o que você deve e quando"
      action={<Button label="Acordo" icon="repeat" variant="secondary" compact onPress={() => router.push('/agreement')} />}
      fab={<Fab label="Devedor" onPress={() => router.push('/receivable')} />}>
      {items.length === 0 ? (
        <EmptyState
          icon="person"
          text="Emprestou dinheiro, pagou algo por alguém ou tem um acordo em que um valor abate o outro todo mês? Registre aqui."
          action={addButtons}
        />
      ) : (
        <>
          <Row style={styles.tiles}>
            <StatTile
              icon="person"
              label="Falta receber"
              value={formatBRL(totals.toReceive)}
              hint={totals.iOwe > 0 ? `Você deve ${formatBRL(totals.iOwe)}` : `${formatBRL(totals.received)} já recebido`}
            />
            <StatTile
              icon={totals.overdue > 0 ? 'warning' : 'check'}
              label="Atrasado"
              value={formatBRL(totals.overdue)}
              tone={totals.overdue > 0 ? 'danger' : 'success'}
              hint={totals.overdue > 0 ? 'Cobre quem está devendo' : 'Ninguém atrasado'}
            />
          </Row>

          <SectionHeader title="Por pessoa" />
          <Card>
            <Row style={[styles.tableRow, { borderBottomColor: theme.border }]}>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.colName}>
                PESSOA
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={[styles.colNum, styles.right]}>
                SALDO
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.colDate}>
                PRÓXIMO
              </ThemedText>
            </Row>
            {people.map((p) => {
              const key = personKey(p.person);
              const active = person === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityHint="Filtra a lista de pagamentos por esta pessoa"
                  onPress={() => setPerson(active ? null : key)}
                  style={({ pressed }) => [
                    styles.tableRow,
                    { borderBottomColor: theme.border },
                    active && { backgroundColor: theme.primarySoft },
                    pressed && styles.pressed,
                  ]}>
                  <Row style={styles.colName}>
                    <ThemedText type={active ? 'smallBold' : 'small'} numberOfLines={1} style={styles.shrink}>
                      {p.person}
                    </ThemedText>
                    {p.hasAgreement ? <Icon name="repeat" size={14} color={theme.accent} /> : null}
                  </Row>
                  <View style={styles.colNum}>
                    <ThemedText
                      type="smallBold"
                      style={[styles.right, p.open < 0 ? { color: theme.warning } : undefined]}>
                      {p.open === 0 ? 'Quites' : formatBRL(Math.abs(p.open))}
                    </ThemedText>
                    {p.open !== 0 ? (
                      <ThemedText type="caption" themeColor="textSecondary" style={styles.right}>
                        {p.open > 0 ? 'te deve' : 'você deve'}
                      </ThemedText>
                    ) : null}
                    {p.overdue > 0 ? (
                      <ThemedText type="caption" style={[styles.right, { color: theme.danger }]}>
                        ! {formatBRL(p.overdue)} atrasado
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.colDate}>
                    {p.nextDue ? formatShort(p.nextDue) : '✓'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </Card>
          {person ? (
            <Button label="Mostrar todas as pessoas" variant="ghost" compact onPress={() => setPerson(null)} />
          ) : null}

          <SectionHeader title="Pagamentos" />
          <Chips
            options={[
              { value: 'open', label: 'Em aberto' },
              { value: 'received', label: 'Acertados' },
              { value: 'all', label: 'Todos' },
            ]}
            value={filter}
            onChange={setFilter}
          />
          {visible.length === 0 ? (
            <EmptyState icon="check" text={filter === 'received' ? 'Nada acertado ainda.' : 'Nada pendente.'} />
          ) : (
            <Card>
              {visible.map((item, i) => (
                <Fragment key={item.key}>
                  {i > 0 ? <Divider /> : null}
                  {item.kind === 'loan' ? (
                    <LoanRow
                      inst={item.inst}
                      today={today}
                      onToggle={() => toggleReceived(item.inst.receivable.id, item.inst.index, today)}
                    />
                  ) : (
                    <AgreementRow
                      occ={item.occ}
                      today={today}
                      cardsLabel={(o) => (o.agreement.iPayMethod ? paymentLabel(o.agreement.iPayMethod, cards) : null)}
                      onToggle={() => toggleAgreementSettled(item.occ.agreement.id, item.occ.date, today)}
                    />
                  )}
                </Fragment>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function LoanRow({ inst, today, onToggle }: { inst: ReceivableInstallment; today: string; onToggle: () => void }) {
  const { receivable: r } = inst;
  const received = inst.status === 'received';
  return (
    <Row style={styles.item}>
      <Pressable style={styles.flex} onPress={() => router.push({ pathname: '/receivable', params: { id: r.id } })}>
        <ThemedText type="default" numberOfLines={1}>
          {r.person} · {r.description}
          {inst.count > 1 ? ` (${inst.index + 1}/${inst.count})` : ''}
        </ThemedText>
        <View style={styles.meta}>
          {received ? (
            <Badge tone="success" label={`Recebido ${formatShort(inst.receivedOn!)}`} />
          ) : inst.status === 'overdue' ? (
            <Badge tone="danger" label={`Atrasado · venceu ${formatShort(inst.due)}`} />
          ) : (
            <Badge tone="neutral" label={`Vence ${formatShort(inst.due)} · ${relativeDays(inst.due, today)}`} />
          )}
        </View>
      </Pressable>
      <ThemedText type="smallBold">{formatBRL(inst.amount)}</ThemedText>
      <Checkbox checked={received} onPress={onToggle} label={`Marcar como recebido: ${r.person}`} />
    </Row>
  );
}

function AgreementRow({
  occ,
  today,
  cardsLabel,
  onToggle,
}: {
  occ: AgreementOccurrence;
  today: string;
  cardsLabel: (o: AgreementOccurrence) => string | null;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const a = occ.agreement;
  const how = cardsLabel(occ);
  return (
    <Row style={styles.item}>
      <Pressable style={styles.flex} onPress={() => router.push({ pathname: '/agreement', params: { id: a.id } })}>
        <Row>
          <Icon name="repeat" size={14} color={theme.accent} />
          <ThemedText type="default" numberOfLines={1} style={styles.shrink}>
            {a.person} · {a.description}
          </ThemedText>
        </Row>
        <ThemedText type="caption" themeColor="textSecondary">
          {formatShort(occ.date)} · te paga {formatBRL(occ.theyPay)} · você paga {formatBRL(occ.iPay)}
          {how ? ` (${how})` : ''}
        </ThemedText>
        <View style={styles.meta}>
          {occ.status === 'compensated' ? (
            <Badge tone="success" label="Compensado" />
          ) : occ.status === 'settled' ? (
            <Badge tone="success" label={`Acertado ${formatShort(occ.settledOn!)}`} />
          ) : occ.status === 'overdue' ? (
            <Badge tone="danger" label={`Atrasado · ${relativeDays(occ.date, today)}`} />
          ) : (
            <Badge tone="neutral" label={relativeDays(occ.date, today)} />
          )}
        </View>
      </Pressable>
      <View style={styles.netCol}>
        <ThemedText type="smallBold" style={occ.net < 0 ? { color: theme.warning } : undefined}>
          {occ.net === 0 ? 'Quites' : `${occ.net > 0 ? '+' : '−'} ${formatBRL(Math.abs(occ.net))}`}
        </ThemedText>
        {occ.net !== 0 ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {occ.net > 0 ? 'te deve' : 'você deve'}
          </ThemedText>
        ) : null}
      </View>
      {occ.status === 'compensated' ? (
        <View style={styles.checkSpace} />
      ) : (
        <Checkbox
          checked={occ.status === 'settled'}
          onPress={onToggle}
          label={`Marcar mês de ${formatShort(occ.date)} com ${a.person} como acertado`}
        />
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  tiles: { alignItems: 'stretch', gap: Spacing.three },
  addRow: { flexWrap: 'wrap', justifyContent: 'center' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  colName: { flex: 1.2, gap: 4 },
  colNum: { flex: 1.3 },
  colDate: { flex: 0.7, textAlign: 'right' },
  right: { textAlign: 'right' },
  item: { paddingVertical: Spacing.two, gap: Spacing.three },
  meta: { marginTop: Spacing.one },
  netCol: { alignItems: 'flex-end' },
  checkSpace: { width: 28 },
});
