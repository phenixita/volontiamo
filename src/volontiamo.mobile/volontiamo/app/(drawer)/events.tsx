import { useCallback, useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../lib/auth';
import { fetchEvents } from '../../lib/api';
import { EventResponse } from '../../lib/types';
import { colors, typography } from '../../theme';

const PAGE_SIZE = 15;

type EventStatus = EventResponse['status'];

function statusLabel(status: EventStatus): string {
  switch (status) {
    case 'Draft': return 'Bozza';
    case 'Active': return 'Attivo';
    case 'Concluded': return 'Concluso';
  }
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EventCard({ event }: { event: EventResponse }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.eventName} numberOfLines={2}>
          {event.name}
        </Text>
        <View style={[styles.statusBadge, statusBadgeStyle(event.status)]}>
          <Text style={[styles.statusText, statusTextStyle(event.status)]}>
            {statusLabel(event.status)}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>📅</Text>
          <Text style={styles.detailValue}>
            {formatDate(event.startAtUtc)} · {formatTime(event.startAtUtc)} – {formatTime(event.endAtUtc)}
          </Text>
        </View>

        {event.location && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📍</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function EventsScreen() {
  const { status } = useAuth();
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async (pageNum: number, replace: boolean) => {
    try {
      const data = await fetchEvents(pageNum, PAGE_SIZE);
      setEvents(prev => replace ? data.items : [...prev, ...data.items]);
      setTotalCount(data.totalCount);
      setPage(pageNum);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;

    setLoading(true);
    loadEvents(1, true).finally(() => setLoading(false));
  }, [loadEvents, status]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents(1, true);
    setRefreshing(false);
  }, [loadEvents]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || events.length >= totalCount) return;
    setLoadingMore(true);
    await loadEvents(page + 1, false);
    setLoadingMore(false);
  }, [loadingMore, events.length, totalCount, page, loadEvents]);

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
        <Text style={styles.loadingText}>Caricamento eventi…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Impossibile caricare gli eventi</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>📋</Text>
        <Text style={styles.emptyTitle}>Nessun evento</Text>
        <Text style={styles.emptyMessage}>
          Non ci sono eventi disponibili al momento.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={item => String(item.id)}
      renderItem={({ item }) => <EventCard event={item} />}
      contentContainerStyle={styles.list}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.brand.red}
          colors={[colors.brand.red]}
        />
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color={colors.brand.red} />
          </View>
        ) : null
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

function statusBadgeStyle(status: EventStatus) {
  switch (status) {
    case 'Active':
      return { backgroundColor: colors.brand.redSoft };
    case 'Draft':
      return { backgroundColor: colors.background.muted };
    case 'Concluded':
      return { backgroundColor: colors.background.subtle };
  }
}

function statusTextStyle(status: EventStatus) {
  switch (status) {
    case 'Active':
      return { color: colors.brand.red };
    case 'Draft':
      return { color: colors.status.draft };
    case 'Concluded':
      return { color: colors.status.concluded };
  }
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: colors.background.raised,
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    shadowColor: '#41251d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  eventName: {
    ...typography.titleMedium,
    color: colors.text.strong,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  cardDetails: {
    marginTop: 14,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    ...typography.bodySmall,
    color: colors.text.soft,
    flex: 1,
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
  errorEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorTitle: {
    ...typography.titleLarge,
    color: colors.text.strong,
    textAlign: 'center',
  },
  errorMessage: {
    ...typography.bodySmall,
    color: colors.text.soft,
    textAlign: 'center',
    marginTop: 8,
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
