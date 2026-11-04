import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Chips,
  EmptyState,
  Fab,
  KeyValue,
  Row,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatShort, relativeDays, todayISO } from '@/domain/dates';
import { formatBRL } from '@/domain/money';
import {
  allReceivableInstallments,
  personSummaries,
  type ReceivableInstallment,
} from '@/domain/receivables';
import { useTheme } from '@/hooks/use-theme';
import { useFinance } from '@/store/finance-store';

type Filter = 'open' | 'received' | 'all';

export default function ReceivablesScreen() {
  const theme = useTheme();
  const receivables = useFinance((s) => s.receivables);
  const toggleReceived = useFinance((s) => s.toggleReceived);
  const today = todayISO();
  const [filter, setFilter] = useState<Filter>('open');
  const [person, setPerson] = useState<string | null>(null);

  const people = useMemo(() => personSummaries(receivables, today), [receivables, today]);
  const installments = useMemo(
    () => allReceivableInstallments(receivables, today).sort((a, b) => a.due.localeCompare(b.due)),
    [receivables, today],
  );

  const totals = people.reduce(
    (acc, p) => ({ open: acc.open + p.open, overdue: acc.overdue + p.overdue, received: acc.received + p.received }),
    { open: 0, overdue: 0, received: 0 },
  );

  const visible = installments.filter(
    (i) =>
      (person === null || i.receivable.person.trim().toLocaleLowerCase('pt-BR') === person) &&
      (filter === 'all' || (filter === 'received' ? i.status === 'received' : i.status !== 'received')),
  );

  return (
    <Screen
      title="Devedores"
      subtitle="Quem te deve e quando vai pagar"
      fab={<Fab label="Devedor" onPress={() => router.push('/receivable')} />}>
      {receivables.length === 0 ? (
        <EmptyState
          text="Emprestou dinheiro ou pagou algo por alguém? Registre aqui para saber quem te deve e quando vai pagar."
          action={<Button label="Adicionar devedor" onPress={() => router.push('/receivable')} />}
        />
      ) : (
        <>
          <Card>
            <KeyValue label="Falta receber" value={formatBRL(totals.open)} strong />
            <KeyValue
              label="Atrasado"
              value={formatBRL(totals.overdue)}
              color={totals.overdue > 0 ? theme.danger : undefined}
            />
            <KeyValue label="Já recebido" value={formatBRL(totals.received)} />
          </Card>

          <SectionHeader title="Por pessoa" />
          <Card>
            <Row style={[styles.tableRow, { borderBottomColor: theme.border }]}>
              <ThemedText type="smallBold" style={styles.colName}>
                Pessoa
              </ThemedText>
              <ThemedText type="smallBold" style={styles.colNum}>
                Deve
              </ThemedText>
              <ThemedText type="smallBold" style={styles.colDate}>
                Próximo
              </ThemedText>
            </Row>
            {people.map((p) => {
              const key = p.person.toLocaleLowerCase('pt-BR');
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
                    active && { backgroundColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type={active ? 'smallBold' : 'small'} style={styles.colName} numberOfLines={1}>
                    {p.person}
                  </ThemedText>
                  <View style={styles.colNum}>
                    <ThemedText type="smallBold" style={styles.right}>
                      {formatBRL(p.open)}
                    </ThemedText>
                    {p.overdue > 0 ? (
                      <ThemedText type="small" style={[styles.right, { color: theme.danger }]}>
                        ! {formatBRL(p.overdue)} atrasado
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.colDate}>
                    {p.nextDue ? formatShort(p.nextDue) : 'quitado ✓'}
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
              { value: 'open', label: 'A receber' },
              { value: 'received', label: 'Recebidos' },
              { value: 'all', label: 'Todos' },
            ]}
            value={filter}
            onChange={setFilter}
          />
          {visible.length === 0 ? (
            <EmptyState text={filter === 'received' ? 'Nada recebido ainda.' : 'Nada pendente. 🎉'} />
          ) : (
            <Card>
              {visible.map((inst) => (
                <InstallmentRow
                  key={`${inst.receivable.id}-${inst.index}`}
                  inst={inst}
                  today={today}
                  onToggle={() => toggleReceived(inst.receivable.id, inst.index, today)}
                />
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function InstallmentRow({
  inst,
  today,
  onToggle,
}: {
  inst: ReceivableInstallment;
  today: string;
  onToggle: () => void;
}) {
  const { receivable: r } = inst;
  const received = inst.status === 'received';
  return (
    <Row style={styles.item}>
      <Pressable
        style={styles.flex}
        onPress={() => router.push({ pathname: '/receivable', params: { id: r.id } })}>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
  },
  colName: { flex: 1.2 },
  colNum: { flex: 1.3 },
  colDate: { flex: 0.8, textAlign: 'right' },
  right: { textAlign: 'right' },
  item: { paddingVertical: Spacing.two, gap: Spacing.three },
  meta: { marginTop: Spacing.one },
});
