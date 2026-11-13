import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getNotificationPermission, type NotificationPermission } from '@/services/reminders';

/**
 * What the system currently allows for notifications. It is read when the screen
 * opens and again when the app comes back to the foreground, which is where the
 * user returns from the system settings after allowing them. `undetermined` until read.
 */
export function useNotificationPermission(): NotificationPermission {
  const [permission, setPermission] = useState<NotificationPermission>('undetermined');

  useEffect(() => {
    let active = true;
    const read = () => {
      void getNotificationPermission().then((answer) => {
        if (active) setPermission(answer);
      });
    };
    read();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return permission;
}
