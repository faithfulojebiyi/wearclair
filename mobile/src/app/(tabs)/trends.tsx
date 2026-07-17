import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';

import { biomarkersControllerGetSeries } from '../../api/generated/biomarkers/biomarkers';
import {
  BiomarkerMetric,
  SeriesBucket,
} from '../../api/generated/wearclairAPI.schemas';
import { Card } from '../../components/ui';
import { c, metricMeta, space } from '../../lib/theme';

const HOUR_MS = 60 * 60 * 1000;

// each range reads the bucket tier that serves it: 6h off the raw hypertable at
// 5-minute grain, 7d the hourly rollup, 30/60d the daily rollup.
const RANGES = [
  { key: '6h', label: '6H', hours: 6, bucket: SeriesBucket['5m'] },
  { key: '7d', label: '7D', hours: 7 * 24, bucket: SeriesBucket['1h'] },
  { key: '30d', label: '30D', hours: 30 * 24, bucket: SeriesBucket['1d'] },
  { key: '60d', label: '60D', hours: 60 * 24, bucket: SeriesBucket['1d'] },
] as const;

const METRICS = Object.keys(metricMeta) as BiomarkerMetric[];

export default function TrendsScreen() {
  const { width } = useWindowDimensions();
  const [metric, setMetric] = useState<BiomarkerMetric>(
    BiomarkerMetric.skin_temp,
  );
  const [rangeKey, setRangeKey] =
    useState<(typeof RANGES)[number]['key']>('30d');

  const range = RANGES.find((entry) => entry.key === rangeKey) ?? RANGES[2];
  const meta = metricMeta[metric];
  const tint = meta.tint;

  const series = useQuery({
    queryKey: ['biomarkers', 'series', metric, range.key],
    queryFn: () =>
      biomarkersControllerGetSeries({
        metric,
        bucket: range.bucket,
        from: new Date(Date.now() - range.hours * HOUR_MS).toISOString(),
        to: new Date().toISOString(),
      }),
  });

  const points = series.data?.points ?? [];
  const values = points.map((point) => point.avg);
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 1;
  const pad = (maxValue - minValue) * 0.25 || 1;
  const chartWidth = width - space.screen * 2 - 40;

  const chartData = points.map((point, index) => ({
    value: point.avg,
    label:
      index % Math.max(1, Math.floor(points.length / 4)) === 0
        ? formatLabel(point.ts, range.bucket)
        : '',
  }));

  const avg = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Trends</Text>

        <ScrollView
          contentContainerStyle={styles.chips}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {METRICS.map((key) => (
            <Chip
              active={key === metric}
              activeColor={metricMeta[key].tint}
              key={key}
              label={metricMeta[key].label}
              onPress={() => setMetric(key)}
            />
          ))}
        </ScrollView>

        <View style={styles.chips}>
          {RANGES.map((entry) => (
            <Chip
              active={entry.key === rangeKey}
              activeColor={c.accent}
              key={entry.key}
              label={entry.label}
              onPress={() => setRangeKey(entry.key)}
            />
          ))}
        </View>

        <Card style={styles.chartCard}>
          <View style={styles.chartHead}>
            <View>
              <Text style={styles.chartTitle}>{meta.label}</Text>
              <Text style={styles.chartSub}>{range.bucket} buckets</Text>
            </View>
            {points.length > 0 ? (
              <View style={styles.avgBox}>
                <Text style={[styles.avgValue, { color: tint }]}>
                  {avg.toFixed(meta.decimals)}
                </Text>
                <Text style={styles.avgUnit}>{meta.unit} avg</Text>
              </View>
            ) : null}
          </View>

          {series.isLoading ? (
            <ActivityIndicator color={tint} style={styles.loader} />
          ) : points.length === 0 ? (
            <Text style={styles.emptyChart}>No data in this range yet.</Text>
          ) : (
            <View style={styles.chartClip}>
              <LineChart
                adjustToWidth
                areaChart
                curved
                data={chartData}
                endFillColor={c.bg}
                endOpacity={0.05}
                hideDataPoints
                hideRules={false}
                initialSpacing={6}
                maxValue={maxValue + pad - (minValue - pad)}
                noOfSections={4}
                rulesColor={c.border}
                rulesType="solid"
                spacing={Math.max(
                  3,
                  chartWidth / Math.max(1, points.length - 1),
                )}
                startFillColor={tint}
                startOpacity={0.28}
                thickness={2.5}
                width={chartWidth}
                xAxisColor={c.border}
                xAxisLabelTextStyle={styles.axis}
                yAxisColor="transparent"
                yAxisOffset={minValue - pad}
                yAxisTextStyle={styles.axis}
                yAxisLabelWidth={38}
                color={tint}
              />
            </View>
          )}

          {points.length > 0 ? (
            <Text style={styles.summary}>
              {points.length} buckets ·{' '}
              {points.reduce((sum, point) => sum + point.count, 0).toLocaleString()}{' '}
              raw samples
            </Text>
          ) : null}
        </Card>

        <Text style={styles.hint}>
          On Skin temp · 30D, look for the +0.4 °C step into the luteal phase —
          the signal the cycle classifier keys on. HRV shows the matching dip.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const Chip = ({
  active,
  activeColor,
  label,
  onPress,
}: {
  active: boolean;
  activeColor: string;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.chip,
      active && { backgroundColor: activeColor, borderColor: activeColor },
    ]}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>
      {label}
    </Text>
  </Pressable>
);

const formatLabel = (iso: string, bucket: SeriesBucket): string => {
  const date = new Date(iso);

  if (bucket === SeriesBucket['1d']) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  safe: { backgroundColor: c.bg, flex: 1 },
  container: {
    gap: space.gap,
    paddingBottom: 40,
    paddingHorizontal: space.screen,
    paddingTop: 8,
  },
  heading: {
    color: c.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  chipText: { color: c.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0E0E10' },
  chartCard: { gap: 16, padding: space.card },
  chartHead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
  chartSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  avgBox: { alignItems: 'flex-end' },
  avgValue: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  avgUnit: { color: c.textMuted, fontSize: 11 },
  chartClip: { overflow: 'hidden' },
  loader: { marginVertical: 70 },
  emptyChart: { color: c.textMuted, fontSize: 14, marginVertical: 50 },
  axis: { color: c.textFaint, fontSize: 10 },
  summary: { color: c.textMuted, fontSize: 12 },
  hint: { color: c.textMuted, fontSize: 13, lineHeight: 20, marginTop: 4 },
});
