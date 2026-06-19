import { useCallback, useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../lib/auth';
import { fetchMyEvents, setEventParticipation } from '../../lib/api';
import { ParticipantEventListView, ParticipantEventResponse, ParticipationStatus } from '../../lib/types';
import { colors, typography } from '../../theme';

const PAGE_SIZE = 15;

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

type EventCardProps = {
  event: ParticipantEventResponse;
  isUpdating: boolean;
  onSetParticipation: (eventId: number, status: ParticipationStatus) => void;
};

function EventCard({ event, isUpdating, onSetParticipation }: EventCardProps) {
  const acceptedSelected = event.participationStatus === 'Accepted';
  const refusedSelected = event.participationStatus === 'Refused';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.eventName} numberOfLines={2}>
          {event.name}
        </Text>
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

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={isUpdating || acceptedSelected}
          onPress={() => onSetParticipation(event.id, 'Accepted')}
          style={({ pressed }) => [
            styles.actionButton,
            acceptedSelected && styles.actionButtonSelected,
            (isUpdating || acceptedSelected) && styles.actionButtonDisabled,
            pressed && !acceptedSelected && styles.actionButtonPressed,
          ]}
        >
          <Text style={[styles.actionText, acceptedSelected && styles.actionTextSelected]}>
            Partecipo
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={isUpdating || refusedSelected}
          onPress={() => onSetParticipation(event.id, 'Refused')}
          style={({ pressed }) => [
            styles.actionButton,
            refusedSelected && styles.actionButtonSelected,
            (isUpdating || refusedSelected) && styles.actionButtonDisabled,
            pressed && !refusedSelected && styles.actionButtonPressed,
          ]}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color={colors.brand.red} />
          ) : (
            <Text style={[styles.actionText, refusedSelected && styles.actionTextSelected]}>
              Rifiuto
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default function EventsScreen() {
  const { status } = useAuth();
  const [view, setView] = useState<ParticipantEventListView>('available');
  const [events, setEvents] = useState<ParticipantEventResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async (pageNum: number, replace: boolean) => {
    try {
      const data = await fetchMyEvents(view, pageNum, PAGE_SIZE);
      setEvents(prev => replace ? data.items : [...prev, ...data.items]);
      setTotalCount(data.totalCount);
      setPage(pageNum);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    }
  }, [view]);

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

  const handleViewChange = useCallback((nextView: ParticipantEventListView) => {
    if (nextView === view) return;
    setView(nextView);
    setEvents([]);
    setPage(1);
    setTotalCount(0);
    setError(null);
  }, [view]);

  const handleSetParticipation = useCallback(async (eventId: number, nextStatus: ParticipationStatus) => {
    setUpdatingIds(prev => new Set(prev).add(eventId));
    const result = await setEventParticipation(eventId, nextStatus);
    setUpdatingIds(prev => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const shouldRemove = (view === 'available' && nextStatus === 'Refused')
      || (view === 'refused' && nextStatus === 'Accepted');

    if (shouldRemove) {
      setEvents(prev => prev.filter(event => event.id !== eventId));
      setTotalCount(prev => Math.max(0, prev - 1));
      return;
    }

    setEvents(prev => prev.map(event => event.id === eventId ? result.data : event));
  }, [view]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: view === 'refused' }}
        onPress={() => handleViewChange(view === 'refused' ? 'available' : 'refused')}
        style={({ pressed }) => [
          styles.filterToggle,
          view === 'refused' && styles.filterToggleSelected,
          pressed && styles.filterTogglePressed,
        ]}
      >
        <View style={[styles.checkbox, view === 'refused' && styles.checkboxSelected]}>
          {view === 'refused' && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.filterText}>Mostra rifiutati</Text>
      </Pressable>
    </View>
  ), [handleViewChange, view]);

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

  return (
    <FlatList
      data={events}
      keyExtractor={item => String(item.id)}
      renderItem={({ item }) => (
        <EventCard
          event={item}
          isUpdating={updatingIds.has(item.id)}
          onSetParticipation={handleSetParticipation}
        />
      )}
      contentContainerStyle={styles.list}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>Nessun evento</Text>
          <Text style={styles.emptyMessage}>
            {view === 'refused'
              ? 'Non ci sono eventi rifiutati al momento.'
              : 'Non ci sono eventi disponibili al momento.'}
          </Text>
        </View>
      }
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

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  header: {
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  filterToggle: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.raised,
  },
  filterToggleSelected: {
    borderColor: colors.brand.red,
    backgroundColor: colors.brand.redSoft,
  },
  filterTogglePressed: {
    opacity: 0.82,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.raised,
  },
  checkboxSelected: {
    borderColor: colors.brand.red,
    backgroundColor: colors.brand.red,
  },
  checkboxMark: {
    color: colors.text.inverse,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  filterText: {
    ...typography.bodySmall,
    color: colors.text.strong,
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
  },
  eventName: {
    ...typography.titleMedium,
    color: colors.text.strong,
    flex: 1,
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
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.raised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  actionButtonSelected: {
    borderColor: colors.brand.red,
    backgroundColor: colors.brand.redSoft,
  },
  actionButtonDisabled: {
    opacity: 0.72,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  actionText: {
    ...typography.bodySmall,
    color: colors.text.strong,
    fontWeight: '600',
  },
  actionTextSelected: {
    color: colors.brand.red,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
