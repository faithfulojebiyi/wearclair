import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { SeriesBucket } from '@/api/generated/wearclairAPI.schemas';
import { Card } from '@/ui/primitives/ui';
import { c, space } from '@/ui/theme/theme';

import { Range, formatSeriesLabel } from '../utils';

interface Point {
  ts: string;
  avg: number;
  count: number;
}

interface MetricMeta {
  label: string;
  unit: string;
  decimals: number;
  tint: string;
}

// the Perform chart card: title + running average + the area line chart for a metric
// over the selected range.
export const MetricChart = ({
  points,
  meta,
  range,
  isLoading,
  chartWidth,
}: {
  points: Point[];
  meta: MetricMeta;
  range: Range;
  isLoading: boolean;
  chartWidth: number;
}) => {
  const values = points.map((point) => point.avg);
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 1;
  const pad = (maxValue - minValue) * 0.25 || 1;

  const chartData = points.map((point, index) => ({
    value: point.avg,
    label:
      index % Math.max(1, Math.floor(points.length / 4)) === 0
        ? formatSeriesLabel(point.ts, range.bucket as SeriesBucket)
        : '',
  }));

  const avg = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

  return (
    <Card style={styles.chartCard}>
      <View style={styles.chartHead}>
        <View>
          <Text style={styles.chartTitle}>{meta.label}</Text>
          <Text style={styles.chartSub}>{range.bucket} buckets</Text>
        </View>
        {points.length > 0 ? (
          <View style={styles.avgBox}>
            <Text style={[styles.avgValue, { color: meta.tint }]}>
              {avg.toFixed(meta.decimals)}
            </Text>
            <Text style={styles.avgUnit}>{meta.unit} avg</Text>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={meta.tint} style={styles.loader} />
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
            spacing={Math.max(3, chartWidth / Math.max(1, points.length - 1))}
            startFillColor={meta.tint}
            startOpacity={0.28}
            thickness={2.5}
            width={chartWidth}
            xAxisColor={c.border}
            xAxisLabelTextStyle={styles.axis}
            yAxisColor="transparent"
            yAxisOffset={minValue - pad}
            yAxisTextStyle={styles.axis}
            yAxisLabelWidth={38}
            color={meta.tint}
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
  );
};

const styles = StyleSheet.create({
  chartCard: { gap: 16, padding: space.card },
  chartHead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartTitle: { color: c.ink, fontSize: 17, fontWeight: '700' },
  chartSub: { color: c.muted, fontSize: 12, marginTop: 2 },
  avgBox: { alignItems: 'flex-end' },
  avgValue: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  avgUnit: { color: c.muted, fontSize: 11 },
  chartClip: { overflow: 'hidden' },
  loader: { marginVertical: 70 },
  emptyChart: { color: c.muted, fontSize: 14, marginVertical: 50 },
  axis: { color: c.faint, fontSize: 10 },
  summary: { color: c.muted, fontSize: 12 },
});
