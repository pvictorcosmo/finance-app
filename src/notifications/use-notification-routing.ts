import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { ADD_EXPENSE_ACTION } from './daily-summary';

/**
 * Opens the right screen when the user taps a notification: the "Lançar gasto"
 * action goes to the assistant; tapping the summary itself goes to the Summary tab.
 * @param ready True once the navigation tree is mounted (store hydrated).
 */
export function useNotificationRouting(ready: boolean) {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !response) return;
    const id = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handled.current === id) return;
    handled.current = id;
    const kind = response.notification.request.content.data?.kind;
    if (response.actionIdentifier === ADD_EXPENSE_ACTION) router.push('/assistant');
    else if (kind === 'daily-summary' || kind === 'daily-summary-test') router.navigate('/');
  }, [ready, response]);
}
