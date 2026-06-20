import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { fetchUnreadNotificationsCount } from './api';
import { useAuth } from './auth';

type NotificationsContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (status !== 'authenticated') {
      setUnreadCount(0);
      return;
    }

    const result = await fetchUnreadNotificationsCount();
    if (!result.ok) {
      console.warn('Unread notifications count unavailable', result.message);
      return;
    }

    setUnreadCount(result.data);
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      setUnreadCount(0);
      return;
    }

    void refreshUnreadCount();
  }, [refreshUnreadCount, status]);

  const value = useMemo<NotificationsContextValue>(() => ({
    unreadCount,
    refreshUnreadCount,
  }), [refreshUnreadCount, unreadCount]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used inside NotificationsProvider.');
  }

  return context;
}
