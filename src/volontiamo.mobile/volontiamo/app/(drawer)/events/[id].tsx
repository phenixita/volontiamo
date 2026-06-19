import { useMemo } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ParticipantEventResponse, ParticipationStatus } from '../../../lib/types';
import { formatEventDate, formatEventTime } from '../../../lib/datetime';
import { colors, typography } from '../../../theme';

function parseEvent(raw: string | string[] | undefined): ParticipantEventResponse | null {
  if (typeof raw !== 'string') {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as ParticipantEventResponse).id === 'number' &&
      typeof (value as ParticipantEventResponse).name === 'string'
    ) {
      return value as ParticipantEventResponse;
    }
  } catch {
    // fall through
  }

  return null;
}

function participationLabel(status: ParticipationStatus | null): string {
  if (status === 'Accepted') return 'Partecipi a questo evento';
  if (status === 'Refused') return 'Hai rifiutato questo evento';
  return 'Nessuna risposta';
}

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ event?: string | string[] }>();
  const event = useMemo(() => parseEvent(params.event), [params.event]);

  if (!event) {
    return (
      <>
        <Stack.Screen options={{ title: 'Dettagli evento' }} />
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Evento non disponibile</Text>
          <Text style={styles.errorMessage}>
            Impossibile mostrare i dettagli dell&apos;evento. Torna indietro e riprova.
          </Text>
        </View>
      </>
    );
  }

  const hasNotes = event.operationalNotesMarkdown.trim().length > 0;

  return (
    <>
      <Stack.Screen options={{ title: event.name }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{event.name}</Text>

        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{participationLabel(event.participationStatus)}</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📅</Text>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Data</Text>
              <Text style={styles.infoValue}>{formatEventDate(event.startAtUtc)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>⏰</Text>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Orario</Text>
              <Text style={styles.infoValue}>
                {formatEventTime(event.startAtUtc)} – {formatEventTime(event.endAtUtc)}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Luogo</Text>
              <Text style={styles.infoValue}>{event.location ?? 'Non specificato'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Dettagli operativi</Text>
        <View style={styles.notesCard}>
          {hasNotes ? (
            <Markdown style={markdownStyles}>{event.operationalNotesMarkdown}</Markdown>
          ) : (
            <Text style={styles.notesEmpty}>Nessun dettaglio operativo disponibile.</Text>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background.page,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    ...typography.displayMedium,
    color: colors.text.strong,
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.brand.redSoft,
  },
  statusText: {
    ...typography.bodySmall,
    color: colors.brand.redDeep,
    fontWeight: '700',
  },
  infoCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.background.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  infoTextGroup: {
    flex: 1,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  infoValue: {
    ...typography.body,
    color: colors.text.strong,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.titleLarge,
    color: colors.text.strong,
    marginTop: 24,
    marginBottom: 10,
  },
  notesCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.background.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
  },
  notesEmpty: {
    ...typography.body,
    color: colors.text.soft,
    fontStyle: 'italic',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.background.page,
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
});

const markdownStyles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.text.strong,
  },
  heading1: {
    ...typography.titleLarge,
    color: colors.text.strong,
    marginTop: 8,
    marginBottom: 6,
  },
  heading2: {
    ...typography.titleMedium,
    color: colors.text.strong,
    marginTop: 8,
    marginBottom: 6,
  },
  heading3: {
    ...typography.titleMedium,
    color: colors.text.strong,
    marginTop: 6,
    marginBottom: 4,
  },
  strong: {
    fontWeight: '700',
    color: colors.text.strong,
  },
  em: {
    fontStyle: 'italic',
  },
  link: {
    color: colors.brand.red,
    textDecorationLine: 'underline',
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
  },
  blockquote: {
    backgroundColor: colors.background.subtle,
    borderLeftColor: colors.brand.red,
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 6,
  },
  code_inline: {
    backgroundColor: colors.background.subtle,
    color: colors.text.strong,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  code_block: {
    backgroundColor: colors.background.subtle,
    color: colors.text.strong,
    borderRadius: 8,
    padding: 12,
  },
  fence: {
    backgroundColor: colors.background.subtle,
    color: colors.text.strong,
    borderRadius: 8,
    padding: 12,
  },
  hr: {
    backgroundColor: colors.border.subtle,
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
});
