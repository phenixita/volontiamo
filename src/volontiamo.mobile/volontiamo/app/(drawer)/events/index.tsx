import { useCallback, useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useAuth } from '../../../lib/auth';
import { AppText } from '../../../components/AppText';
import { applyForEvent, fetchMyEvents, markEventNotInterested, restoreEventAvailability } from '../../../lib/api';
import { ParticipantEventListView, ParticipantEventResponse, ParticipationStatus } from '../../../lib/types';
import { formatEventDate, formatEventTime } from '../../../lib/datetime';
import { colors, typography } from '../../../theme';

const PAGE_SIZE = 15;

type EventAction = 'candidata' | 'non-interessata' | 'restore';

type EventCardProps = {
  event: ParticipantEventResponse;
  view: ParticipantEventListView;
  isUpdating: boolean;
  onRunAction: (eventId: number, action: EventAction) => void;
  onShowDetails: (event: ParticipantEventResponse) => void;
};

function statusBadgeLabel(status: ParticipationStatus): string {
  switch (status) {
    case 'Candidata':
      return 'Candidata';
    case 'Partecipa':
      return 'Partecipa';
    case 'Rifiutata':
      return 'Rifiutata';
    case 'NonInteressata':
      return 'Non interessata';
  }
}

function EventCard({ event, view, isUpdating, onRunAction, onShowDetails }: EventCardProps) {
  const participationStatus = event.participationStatus;
  const canApply = participationStatus === null;
  const canMarkNotInterested = participationStatus === null;
  const canRestore = participationStatus === 'NonInteressata';
  const showStatusBadge = participationStatus === 'Candidata' || participationStatus === 'Partecipa' || participationStatus === 'Rifiutata';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <AppText style={styles.eventName}>
          {event.name}
        </AppText>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <AppText style={styles.detailLabel}>📅</AppText>
          <AppText style={styles.detailValue}>
            {formatEventDate(event.startAtUtc)} · {formatEventTime(event.startAtUtc)} – {formatEventTime(event.endAtUtc)}
          </AppText>
        </View>

        {event.location && (
          <View style={styles.detailRow}>
            <AppText style={styles.detailLabel}>📍</AppText>
            <AppText style={styles.detailValue}>
              {event.location}
            </AppText>
          </View>
        )}
      </View>

      {view === 'non-interessata' ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isUpdating || !canRestore}
            onPress={() => onRunAction(event.id, 'restore')}
            style={({ pressed }) => [
              styles.actionButton,
              styles.acceptButton,
              (isUpdating || !canRestore) && styles.actionButtonDisabled,
              pressed && canRestore && styles.actionButtonPressed,
            ]}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color={colors.positive.greenDeep} />
            ) : (
              <AppText style={[styles.actionText, styles.acceptText]}>Torna disponibile</AppText>
            )}
          </Pressable>
        </View>
      ) : showStatusBadge ? (
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, participationStatus === 'Candidata' ? styles.statusBadgeCandidate : styles.statusBadgeFinal]}>
            <AppText style={[styles.statusBadgeText, participationStatus === 'Candidata' ? styles.statusBadgeCandidateText : styles.statusBadgeFinalText]}>
              {statusBadgeLabel(participationStatus!)}
            </AppText>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isUpdating || !canMarkNotInterested}
            onPress={() => onRunAction(event.id, 'non-interessata')}
            style={({ pressed }) => [
              styles.actionButton,
              (isUpdating || !canMarkNotInterested) && styles.actionButtonDisabled,
              pressed && canMarkNotInterested && styles.actionButtonPressed,
            ]}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color={colors.brand.red} />
            ) : (
              <AppText style={styles.actionText}>Non interessata</AppText>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isUpdating || !canApply}
            onPress={() => onRunAction(event.id, 'candidata')}
            style={({ pressed }) => [
              styles.actionButton,
              styles.acceptButton,
              (isUpdating || !canApply) && styles.actionButtonDisabled,
              pressed && canApply && styles.actionButtonPressed,
            ]}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color={colors.positive.greenDeep} />
            ) : (
              <AppText style={[styles.actionText, styles.acceptText]}>Candidati</AppText>
            )}
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => onShowDetails(event)}
        style={({ pressed }) => [styles.detailsButton, pressed && styles.detailsButtonPressed]}
      >
        <AppText style={styles.detailsButtonText}>DETTAGLI →</AppText>
      </Pressable>
    </View>
  );
}

export default function EventsScreen() {
  const { status } = useAuth();
  const router = useRouter();
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

  const handleRunAction = useCallback(async (eventId: number, action: EventAction) => {
    setUpdatingIds(prev => new Set(prev).add(eventId));
    const result = action === 'candidata'
      ? await applyForEvent(eventId)
      : action === 'non-interessata'
        ? await markEventNotInterested(eventId)
        : await restoreEventAvailability(eventId);

    setUpdatingIds(prev => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const shouldRemove = (view === 'available' && action === 'non-interessata')
      || (view === 'non-interessata' && action === 'restore');

    if (shouldRemove) {
      setEvents(prev => prev.filter(event => event.id !== eventId));
      setTotalCount(prev => Math.max(0, prev - 1));
      return;
    }

    setEvents(prev => prev.map(event => event.id === eventId ? result.data : event));
  }, [view]);

  const handleShowDetails = useCallback((event: ParticipantEventResponse) => {
    router.push({
      pathname: '/(drawer)/events/[id]',
      params: { id: String(event.id), event: JSON.stringify(event) },
    });
  }, [router]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: view === 'non-interessata' }}
        onPress={() => handleViewChange(view === 'non-interessata' ? 'available' : 'non-interessata')}
        style={({ pressed }) => [
          styles.filterToggle,
          view === 'non-interessata' && styles.filterToggleSelected,
          pressed && styles.filterTogglePressed,
        ]}
      >
        <View style={[styles.checkbox, view === 'non-interessata' && styles.checkboxSelected]}>
          {view === 'non-interessata' && <AppText style={styles.checkboxMark}>✓</AppText>}
        </View>
        <AppText style={styles.filterText}>Mostra non interessata</AppText>
      </Pressable>
    </View>
  ), [handleViewChange, view]);

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.red} />
        <AppText style={styles.loadingText}>Apertura sessione...</AppText>
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
        <AppText style={styles.loadingText}>Caricamento eventi…</AppText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <AppText style={styles.errorEmoji}>⚠️</AppText>
        <AppText style={styles.errorTitle}>Impossibile caricare gli eventi</AppText>
        <AppText style={styles.errorMessage}>{error}</AppText>
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
          view={view}
          isUpdating={updatingIds.has(item.id)}
          onRunAction={handleRunAction}
          onShowDetails={handleShowDetails}
        />
      )}
      contentContainerStyle={styles.list}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <AppText style={styles.emptyEmoji}>📋</AppText>
          <AppText style={styles.emptyTitle}>Nessun evento</AppText>
          <AppText style={styles.emptyMessage}>
            {view === 'non-interessata'
              ? 'Non hai eventi esclusi da recuperare al momento.'
              : 'Non ci sono eventi disponibili al momento.'}
          </AppText>
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
    minHeight: 48,
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
  statusRow: {
    marginTop: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeCandidate: {
    backgroundColor: colors.brand.redSoft,
  },
  statusBadgeFinal: {
    backgroundColor: colors.background.subtle,
  },
  statusBadgeText: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  statusBadgeCandidateText: {
    color: colors.brand.redDeep,
  },
  statusBadgeFinalText: {
    color: colors.text.soft,
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
    minHeight: 48,
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
  acceptButton: {
    borderColor: colors.positive.green,
    backgroundColor: colors.positive.greenSoft,
  },
  acceptButtonSelected: {
    borderColor: colors.positive.greenDeep,
    backgroundColor: colors.positive.green,
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
  acceptText: {
    color: colors.positive.greenDeep,
  },
  acceptTextSelected: {
    color: colors.text.inverse,
  },
  detailsButton: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.brand.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: colors.brand.redSoft,
  },
  detailsButtonPressed: {
    backgroundColor: colors.brand.redGlow,
  },
  detailsButtonText: {
    ...typography.bodySmall,
    color: colors.brand.redDeep,
    fontWeight: '700',
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
