import { useCallback, useEffect, useMemo, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  fetchNotificationsInbox,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { formatEventDate, formatEventTime } from '../../../lib/datetime';
import { useNotifications } from '../../../lib/notifications';
import { NotificationResponse } from '../../../lib/types';
import { colors, typography } from '../../../theme';

const PAGE_SIZE = 15;

function sortNotifications(items: NotificationResponse[]): NotificationResponse[] {
  return [...items].sort((left, right) => (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  ));
}

function mergeNotifications(
  current: NotificationResponse[],
  incoming: NotificationResponse[],
): NotificationResponse[] {
  const byId = new Map(current.map(notification => [notification.id, notification]));
  incoming.forEach(notification => byId.set(notification.id, notification));
  return sortNotifications(Array.from(byId.values()));
}

type NotificationCardProps = {
  notification: NotificationResponse;
  opening: boolean;
  onOpen: (notification: NotificationResponse) => void;
};

function NotificationCard({ notification, opening, onOpen }: NotificationCardProps) {
  const isUnread = notification.readAt === null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(notification)}
      style={({ pressed }) => [
        styles.card,
        isUnread && styles.cardUnread,
        opening && styles.cardDisabled,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardTopContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {notification.title}
          </Text>
          <Text style={styles.cardMeta}>
            {formatEventDate(notification.createdAt)} · {formatEventTime(notification.createdAt)}
          </Text>
        </View>
        {opening ? (
          <ActivityIndicator size="small" color={colors.brand.red} />
        ) : isUnread ? (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>Nuova</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.cardBody}>{notification.body}</Text>

      <Text style={styles.cardAction}>APRI EVENTO →</Text>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { status } = useAuth();
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [openingIds, setOpeningIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const canMarkAllAsRead = useMemo(
    () => unreadCount > 0 && !markingAll,
    [markingAll, unreadCount],
  );

  const loadNotifications = useCallback(async (pageNum: number, replace: boolean) => {
    try {
      const data = await fetchNotificationsInbox(pageNum, PAGE_SIZE);
      setNotifications(prev => replace ? sortNotifications(data.items) : mergeNotifications(prev, data.items));
      setTotalCount(data.totalCount);
      setPage(pageNum);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Errore sconosciuto');
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;

    setLoading(true);
    loadNotifications(1, true).finally(() => setLoading(false));
  }, [loadNotifications, status]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadNotifications(1, true),
      refreshUnreadCount(),
    ]);
    setRefreshing(false);
  }, [loadNotifications, refreshUnreadCount]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || notifications.length >= totalCount) return;

    setLoadingMore(true);
    await loadNotifications(page + 1, false);
    setLoadingMore(false);
  }, [loadingMore, notifications.length, page, totalCount, loadNotifications]);

  const handleMarkAllAsRead = useCallback(async () => {
    setMarkingAll(true);
    const result = await markAllNotificationsAsRead();
    setMarkingAll(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const readAt = new Date().toISOString();
    setNotifications(prev => prev.map(notification => (
      notification.readAt === null
        ? { ...notification, readAt }
        : notification
    )));
    setError(null);
    await refreshUnreadCount();
  }, [refreshUnreadCount]);

  const handleOpenNotification = useCallback(async (notification: NotificationResponse) => {
    setOpeningIds(prev => new Set(prev).add(notification.id));

    if (notification.readAt === null) {
      const result = await markNotificationAsRead(notification.id);
      if (!result.ok) {
        setOpeningIds(prev => {
          const next = new Set(prev);
          next.delete(notification.id);
          return next;
        });
        setError(result.message);
        return;
      }

      setNotifications(prev => prev.map(item => item.id === notification.id ? result.data : item));
      setError(null);
      await refreshUnreadCount();
    }

    setOpeningIds(prev => {
      const next = new Set(prev);
      next.delete(notification.id);
      return next;
    });

    router.push({
      pathname: '/(drawer)/events/[id]',
      params: { id: String(notification.eventId) },
    });
  }, [refreshUnreadCount, router]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <View style={styles.headerTextGroup}>
        <Text style={styles.headerTitle}>Inbox notifiche</Text>
        <Text style={styles.headerSubtitle}>
          Apri una notifica per segnalarla come letta e saltare al dettaglio evento.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canMarkAllAsRead}
        onPress={() => void handleMarkAllAsRead()}
        style={({ pressed }) => [
          styles.markAllButton,
          !canMarkAllAsRead && styles.markAllButtonDisabled,
          pressed && canMarkAllAsRead && styles.markAllButtonPressed,
        ]}
      >
        {markingAll ? (
          <ActivityIndicator size="small" color={colors.text.inverse} />
        ) : (
          <Text style={styles.markAllButtonText}>Segna tutto come letto</Text>
        )}
      </Pressable>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}
    </View>
  ), [canMarkAllAsRead, error, handleMarkAllAsRead, markingAll]);

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.red} />
        <Text style={styles.loadingText}>Apertura sessione...</Text>
      </View>
    );
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.red} />
        <Text style={styles.loadingText}>Caricamento notifiche…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notifications}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <NotificationCard
          notification={item}
          opening={openingIds.has(item.id)}
          onOpen={notification => void handleOpenNotification(notification)}
        />
      )}
      contentContainerStyle={styles.list}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={(
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>Nessuna notifica</Text>
          <Text style={styles.emptyMessage}>
            Qui troverai gli aggiornamenti sugli eventi appena saranno disponibili.
          </Text>
        </View>
      )}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={colors.brand.red}
          colors={[colors.brand.red]}
        />
      )}
      ListFooterComponent={loadingMore ? (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.brand.red} />
        </View>
      ) : null}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  header: {
    marginBottom: 14,
    gap: 12,
  },
  headerTextGroup: {
    gap: 4,
  },
  headerTitle: {
    ...typography.titleLarge,
    color: colors.text.strong,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.text.soft,
  },
  markAllButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.red,
  },
  markAllButtonDisabled: {
    opacity: 0.45,
  },
  markAllButtonPressed: {
    opacity: 0.85,
  },
  markAllButtonText: {
    ...typography.bodySmall,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  errorBanner: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.brand.redSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brand.red,
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: colors.brand.redDeep,
  },
  separator: {
    height: 12,
  },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.background.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    shadowColor: '#41251d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  cardUnread: {
    borderColor: colors.brand.red,
    backgroundColor: colors.brand.redSoft,
  },
  cardDisabled: {
    opacity: 0.82,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTopContent: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    ...typography.titleMedium,
    color: colors.text.strong,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.text.soft,
  },
  unreadPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.brand.red,
  },
  unreadPillText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  cardBody: {
    ...typography.body,
    color: colors.text.soft,
    marginTop: 14,
  },
  cardAction: {
    ...typography.bodySmall,
    color: colors.brand.redDeep,
    fontWeight: '700',
    marginTop: 16,
    letterSpacing: 0.6,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.soft,
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    ...typography.titleLarge,
    color: colors.text.strong,
  },
  emptyMessage: {
    ...typography.body,
    color: colors.text.soft,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
