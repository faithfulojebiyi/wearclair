import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VitalsTiles } from '@/modules/biomarkers/components/vitals-tiles';
import { useLiveReadings } from '@/modules/biomarkers/use-live-readings';
import { PredictionsCard } from '@/modules/cycle/components/predictions-card';
import { QuickActions } from '@/modules/cycle/components/quick-actions';
import { usePredictions } from '@/modules/cycle/queries/use-predictions';
import { HormoneChartCard } from '@/modules/insights/components/hormone-chart';
import { HormoneGrid } from '@/modules/insights/components/hormone-grid';
import { SCOPES, Scope } from '@/modules/insights/hormone-chart';
import { useInsightRange } from '@/modules/insights/queries/use-insight-range';
import { useTodayInsight } from '@/modules/insights/queries/use-today-insight';
import { Card, InnerCard, Pill, SectionTitle, Segmented } from '@/ui/primitives/ui';
import { c, phaseMeta, serifBold, space } from '@/ui/theme/theme';

const greeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good Morning!';
  }

  return hour < 18 ? 'Good Afternoon!' : 'Good Evening!';
};

const dateLabel = new Date().toLocaleDateString(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();

  const [scope, setScope] = useState<Scope>('month');

  const today = useTodayInsight();
  const range = useInsightRange();
  const predictions = usePredictions();
  const { connected, readings } = useLiveReadings();

  // dedicated pull-to-refresh state — NOT query.isRefetching, which flips on every
  // background refetch (the 8s sync invalidates insights), making the page jump.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['insights'] }),
      queryClient.invalidateQueries({ queryKey: ['cycle', 'predictions'] }),
      queryClient.invalidateQueries({ queryKey: ['biomarkers'] }),
    ]);
    setRefreshing(false);
  };

  const insight = today.data;
  const phase = insight ? phaseMeta[insight.phase] : null;
  const chartWidth = width - space.screen * 2 - 56;

  if (today.isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={c.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={c.accent}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
        </View>

        {insight && phase ? (
          <Card>
            <View style={styles.phaseHead}>
              <Pill
                color={phase.color}
                label={`${phase.label} phase`}
                soft={phase.soft}
              />
              <Text style={styles.cycleDay}>Day {insight.cycleDay}</Text>
            </View>

            <View style={styles.scopeRow}>
              <Segmented onChange={setScope} options={SCOPES} value={scope} />
            </View>

            <HormoneChartCard
              chartWidth={chartWidth}
              insights={range.data?.insights ?? []}
              scope={scope}
            />

            <HormoneGrid hormones={insight.hormones} />
          </Card>
        ) : (
          <Card>
            <InnerCard>
              <Text style={styles.empty}>
                No insights yet — connect your band to decode your cycle.
              </Text>
            </InnerCard>
          </Card>
        )}

        <SectionTitle>Predictions</SectionTitle>
        <PredictionsCard predictions={predictions.data} />

        <SectionTitle>Quick Actions</SectionTitle>
        <QuickActions />

        <VitalsTiles connected={connected} readings={readings} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: c.bg, flex: 1 },
  center: {
    alignItems: 'center',
    backgroundColor: c.bg,
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    gap: space.gap,
    paddingBottom: 120,
    paddingHorizontal: space.screen,
    paddingTop: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  greeting: { color: c.ink, fontFamily: serifBold, fontSize: 30 },
  date: { color: c.muted, fontSize: 14, marginTop: 3 },
  phaseHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  cycleDay: { color: c.inkSoft, fontSize: 14, fontWeight: '700' },
  scopeRow: { marginBottom: 12, paddingHorizontal: 2 },
  empty: { color: c.muted, fontSize: 15, textAlign: 'center' },
});
