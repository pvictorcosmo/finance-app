import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, parseISO, todayISO } from '@/domain/dates';
import { buildDailySummary } from '@/domain/summary';
import type { DailySummarySettings, FinanceData } from '@/domain/types';

/**
 * Resumo diário por notificação local (funciona no Expo Go).
 *
 * Notificações agendadas têm texto fixo, então agendamos os próximos dias com o
 * resumo calculado para cada um e reagendamos sempre que os dados mudam ou o app abre.
 */

/** Canal Android com importância alta: é o que faz a notificação aparecer flutuando (heads-up). */
const CHANNEL_ID = 'daily-summary';
const KIND = 'daily-summary';
/** Notification category that adds the "Lançar gasto" action button. */
export const SUMMARY_CATEGORY = 'daily-summary';
/** Action identifier of the "Lançar gasto" button. */
export const ADD_EXPENSE_ACTION = 'add-expense';
/** Quantos dias à frente agendar (o iOS limita a 64 pendentes; ficamos bem abaixo). */
const DAYS_AHEAD = 14;

export const notificationsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

let configured = false;

/** Configura como as notificações aparecem com o app aberto e cria o canal do Android. */
export async function configureNotifications(): Promise<void> {
  if (!notificationsSupported || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  try {
    await Notifications.setNotificationCategoryAsync(SUMMARY_CATEGORY, [
      { identifier: ADD_EXPENSE_ACTION, buttonTitle: 'Lançar gasto', options: { opensAppToForeground: true } },
    ]);
  } catch (error) {
    console.warn('Notification actions unavailable', error);
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Resumo diário',
      description: 'Como está seu mês: saldo livre e situação de cada categoria',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      enableVibrate: true,
      lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    });
  }
}

export type PermissionResult = 'granted' | 'denied' | 'unsupported';

export async function getPermission(): Promise<PermissionResult> {
  if (!notificationsSupported) return 'unsupported';
  const { granted } = await Notifications.getPermissionsAsync();
  return granted ? 'granted' : 'denied';
}

/** Pede permissão (no Android 13+ o canal precisa existir antes do pedido). */
export async function requestPermission(): Promise<PermissionResult> {
  if (!notificationsSupported) return 'unsupported';
  await configureNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted ? 'granted' : 'denied';
}

async function cancelDailySummaries(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Data/hora local de `iso` às hh:mm. */
function at(iso: string, hour: number, minute: number): Date {
  const { y, m, d } = parseISO(iso);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

/**
 * Cancela e agenda de novo os próximos dias. Retorna quantas foram agendadas.
 * Não faz nada (só cancela) se o aviso estiver desligado ou sem permissão.
 */
export async function rescheduleDailySummaries(
  data: FinanceData,
  settings: DailySummarySettings | undefined,
): Promise<number> {
  if (!notificationsSupported) return 0;
  await configureNotifications();
  await cancelDailySummaries();
  if (!settings?.enabled || (await getPermission()) !== 'granted') return 0;

  const now = new Date();
  const today = todayISO();
  let count = 0;
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    const when = at(date, settings.hour, settings.minute);
    if (when <= now) continue;
    const { title, body } = buildDailySummary(data, date);
    await Notifications.scheduleNotificationAsync({
      identifier: `${KIND}-${date}`,
      content: { title, body, data: { kind: KIND, date }, sound: 'default', categoryIdentifier: SUMMARY_CATEGORY },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL_ID },
    });
    count++;
  }
  return count;
}

/** Envia o resumo de hoje para testar: na hora (null) ou daqui a `seconds` segundos. */
export async function sendTestSummary(data: FinanceData, seconds: number | null): Promise<PermissionResult> {
  const permission = await requestPermission();
  if (permission !== 'granted') return permission;
  const { title, body } = buildDailySummary(data, todayISO());
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { kind: 'daily-summary-test' }, sound: 'default', categoryIdentifier: SUMMARY_CATEGORY },
    trigger: seconds
      ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL_ID }
      : Platform.OS === 'android'
        ? { channelId: CHANNEL_ID }
        : null,
  });
  return 'granted';
}
