import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useAuth } from '../../lib/auth';
import { fetchMyReport } from '../../lib/api';
import type { VolunteerReportingResponse } from '../../lib/types';
import { colors, typography } from '../../theme';
import { AppText } from '../../components/AppText';

function formatHours(hours: number): string {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(hours);
}

type StatCardProps = {
  label: string;
  value: string;
  accent?: boolean;
  helper: string;
};

function StatCard({ label, value, accent = false, helper }: StatCardProps) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <AppText style={[styles.statLabel, accent && styles.statLabelAccent]}>{label}</AppText>
      <AppText style={[styles.statValue, accent && styles.statValueAccent]}>{value}</AppText>
      <AppText style={[styles.statHelper, accent && styles.statHelperAccent]}>{helper}</AppText>
    </View>
  );
}

export default function StatsScreen() {
  const { status, user } = useAuth();
  const [report, setReport] = useState<VolunteerReportingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    const result = await fetchMyReport();
    if (!result.ok) {
      setError(result.message);
      setReport(null);
      return;
    }

    setReport(result.data);
    setError(null);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    setLoading(true);
    loadReport().finally(() => setLoading(false));
  }, [loadReport, status]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReport();
    setRefreshing(false);
  }, [loadReport]);

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.red} />
        <AppText style={styles.loadingText}>Apertura statistiche...</AppText>
      </View>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.red} />
        <AppText style={styles.loadingText}>Caricamento statistiche…</AppText>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.centered}>
        <AppText style={styles.errorEmoji}>⚠️</AppText>
        <AppText style={styles.errorTitle}>Statistiche non disponibili</AppText>
        <AppText style={styles.errorMessage}>{error ?? 'Risposta rendicontazione non disponibile.'}</AppText>
        <Pressable style={styles.retryButton} onPress={() => {
          setLoading(true);
          loadReport().finally(() => setLoading(false));
        }}>
          <AppText style={styles.retryButtonText}>Riprova</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.brand.red}
          colors={[colors.brand.red]}
        />
      }
    >
      <View style={styles.heroCard}>
        <AppText style={styles.heroEyebrow}>Rendicontazione personale</AppText>
        <AppText style={styles.heroTitle}>Le tue ore donate</AppText>
        <AppText style={styles.heroValue}>{formatHours(report.totalHours)}</AppText>
        <AppText style={styles.heroHelper}>Somma delle durate degli eventi conclusi a cui hai confermato la presenza.</AppText>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          label="Eventi conclusi"
          value={String(report.participatedEventsCount)}
          helper="Eventi rendicontati con tua presenza accettata."
        />
        <StatCard
          label="Posizione"
          value={`#${report.rank}`}
          helper={`Classifica anonima su ${report.totalVolunteers} volontari.`}
          accent
        />
      </View>

      <View style={styles.noteCard}>
        <AppText style={styles.noteTitle}>Come viene calcolato</AppText>
        <AppText style={styles.noteBody}>
          Le ore derivano dagli eventi in stato concluso. Per ogni evento viene considerata la durata compresa tra inizio e fine e, per la tua scheda personale, conta solo la tua partecipazione accettata.
        </AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: 16,
    gap: 14,
    backgroundColor: colors.background.page,
  },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: colors.brand.red,
    shadowColor: '#7f1119',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 5,
  },
  heroEyebrow: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.78)',
  },
  heroTitle: {
    ...typography.displayMedium,
    color: colors.text.inverse,
    marginTop: 8,
  },
  heroValue: {
    ...typography.displayLarge,
    color: colors.text.inverse,
    marginTop: 20,
    fontSize: 44,
    lineHeight: 48,
  },
  heroHelper: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 10,
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: colors.background.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
  },
  statCardAccent: {
    backgroundColor: colors.brand.redSoft,
    borderColor: colors.brand.red,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.soft,
  },
  statLabelAccent: {
    color: colors.brand.redDeep,
  },
  statValue: {
    ...typography.displayLarge,
    color: colors.text.strong,
    marginTop: 10,
  },
  statValueAccent: {
    color: colors.brand.redDeep,
  },
  statHelper: {
    ...typography.bodySmall,
    color: colors.text.soft,
    marginTop: 8,
  },
  statHelperAccent: {
    color: colors.brand.redDeep,
  },
  noteCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: colors.background.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
  },
  noteTitle: {
    ...typography.titleMedium,
    color: colors.text.strong,
  },
  noteBody: {
    ...typography.bodySmall,
    color: colors.text.soft,
    marginTop: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.background.page,
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
  retryButton: {
    marginTop: 16,
    minHeight: 48,
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.brand.red,
    paddingHorizontal: 18,
  },
  retryButtonText: {
    ...typography.titleMedium,
    color: colors.text.inverse,
  },
});