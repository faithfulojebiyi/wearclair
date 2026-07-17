import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { biomarkersControllerGetLatest } from '../../api/generated/biomarkers/biomarkers';
import {
  insightsControllerGetRange,
  insightsControllerGetToday,
} from '../../api/generated/insights/insights';
import { GaugeArc } from '../../components/gauge-arc';
import { Card, Pill, SectionTitle } from '../../components/ui';
import { c, metricMeta, phaseMeta, scoreColor, space } from '../../lib/theme';

const DAY_MS = 24 * 60 * 60 * 1000;

const todayLabel = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

export default function TodayScreen() {
  const today = useQuery({
    queryKey: ['insights', 'today'],
    queryFn: () => insightsControllerGetToday(),
  });

  const timeline = useQuery({
    queryKey: ['insights', 'range'],
    queryFn: () =>
      insightsControllerGetRange({
        from: new Date(Date.now() - 28 * DAY_MS).toISOString(),
        to: new Date(Date.now() + DAY_MS).toISOString(),
      }),
  });

  const latest = useQuery({
    queryKey: ['biomarkers', 'latest'],
    queryFn: () => biomarkersControllerGetLatest(),
  });

  const refreshing = today.isRefetching || latest.isRefetching;
  const insight = today.data;
  const phase = insight ? phaseMeta[insight.phase] : null;

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
            onRefresh={() => {
              today.refetch();
              timeline.refetch();
              latest.refetch();
            }}
            refreshing={refreshing}
            tintColor={c.accent}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Today</Text>
            <Text style={styles.date}>{todayLabel}</Text>
          </View>
          <View style={styles.brandDot}>
            <Text style={styles.brandDotText}>C</Text>
          </View>
        </View>

        {insight && phase ? (
          <Card style={styles.hero}>
            <View style={styles.gaugeWrap}>
              <GaugeArc
                big={String(insight.readiness)}
                color={scoreColor(insight.readiness)}
                label="Readiness"
                sub={`vs your 14-day baseline`}
                value={insight.readiness}
              />
            </View>

            <View style={styles.phaseRow}>
              <Pill color={phase.color} label={phase.label} soft={phase.soft} />
              <Text style={styles.cycleDay}>Cycle day {insight.cycleDay}</Text>
            </View>

            <Text style={styles.blurb}>{phase.blurb}</Text>
          </Card>
        ) : (
          <Card style={styles.hero}>
            <Text style={styles.empty}>
              No insights yet — sync your device to decode your cycle.
            </Text>
          </Card>
        )}

        {timeline.data && timeline.data.insights.length > 0 ? (
          <View>
            <SectionTitle>Last 28 days</SectionTitle>
            <View style={styles.timeline}>
              {timeline.data.insights.map((day) => (
                <View
                  key={day.date}
                  style={[
                    styles.seg,
                    { backgroundColor: phaseMeta[day.phase].color },
                  ]}
                />
              ))}
            </View>
            <View style={styles.legend}>
              {Object.values(phaseMeta).map((meta) => (
                <View key={meta.label} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: meta.color }]}
                  />
                  <Text style={styles.legendText}>{meta.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <SectionTitle>Vitals</SectionTitle>
        <View style={styles.tiles}>
          {(latest.data?.readings ?? []).map((reading) => {
            const meta = metricMeta[reading.metric];

            return (
              <Card key={reading.metric} style={styles.tile}>
                <View style={styles.tileHead}>
                  <View style={[styles.tileDot, { backgroundColor: meta.tint }]} />
                  <Text style={styles.tileLabel}>{meta.label}</Text>
                </View>
                <Text style={styles.tileValue}>
                  {reading.value.toFixed(meta.decimals)}
                  <Text style={styles.tileUnit}> {meta.unit}</Text>
                </Text>
              </Card>
            );
          })}
        </View>

        {insight ? (
          <Text style={styles.lineage}>
            Derived from {insight.sourceSampleCount.toLocaleString()} raw samples
          </Text>
        ) : null}
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
    paddingBottom: 40,
    paddingHorizontal: space.screen,
    paddingTop: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  hello: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  date: { color: c.textMuted, fontSize: 14, marginTop: 2 },
  brandDot: {
    alignItems: 'center',
    backgroundColor: c.accentSoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  brandDotText: { color: c.accent, fontSize: 18, fontWeight: '800' },
  hero: { alignItems: 'center', gap: 16, paddingVertical: 24 },
  gaugeWrap: { alignItems: 'center' },
  phaseRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  cycleDay: { color: c.textDim, fontSize: 15, fontWeight: '600' },
  blurb: {
    color: c.textDim,
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  empty: { color: c.textMuted, fontSize: 15, textAlign: 'center' },
  timeline: {
    flexDirection: 'row',
    gap: 3,
    height: 40,
  },
  seg: { borderRadius: 3, flex: 1 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
  },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  legendDot: { borderRadius: 3, height: 6, width: 6 },
  legendText: { color: c.textMuted, fontSize: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.gap },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 10, padding: 14 },
  tileHead: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  tileDot: { borderRadius: 3, height: 6, width: 6 },
  tileLabel: { color: c.textMuted, fontSize: 13 },
  tileValue: {
    color: c.text,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tileUnit: { color: c.textMuted, fontSize: 13, fontWeight: '500' },
  lineage: {
    color: c.textFaint,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
