import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BiomarkerMetric } from '@/api/generated/wearclairAPI.schemas';
import { Chip } from '@/modules/biomarkers/components/chip';
import { MetricChart } from '@/modules/biomarkers/components/metric-chart';
import { useBiomarkerSeries } from '@/modules/biomarkers/queries/use-biomarker-series';
import { METRIC_ORDER, RANGES, RangeKey } from '@/modules/biomarkers/utils';
import { c, metricMeta, serifBold, space } from '@/ui/theme/theme';

export default function PerformScreen() {
  const { width } = useWindowDimensions();
  const [metric, setMetric] = useState<BiomarkerMetric>(
    BiomarkerMetric.skin_temp,
  );
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d');

  const range = RANGES.find((entry) => entry.key === rangeKey) ?? RANGES[2];
  const meta = metricMeta[metric];

  const series = useBiomarkerSeries(metric, range);
  const chartWidth = width - space.screen * 2 - 40;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Perform</Text>

        <ScrollView
          contentContainerStyle={styles.chips}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {METRIC_ORDER.map((key) => (
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

        <MetricChart
          chartWidth={chartWidth}
          isLoading={series.isLoading}
          meta={meta}
          points={series.data?.points ?? []}
          range={range}
        />

        <Text style={styles.hint}>
          On Skin temp · 30D, look for the +0.4 °C step into the luteal phase — the
          signal the cycle classifier keys on. HRV shows the matching dip.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: c.bg, flex: 1 },
  container: {
    gap: space.gap,
    paddingBottom: 120,
    paddingHorizontal: space.screen,
    paddingTop: 8,
  },
  heading: { color: c.ink, fontFamily: serifBold, fontSize: 28 },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  hint: { color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 4 },
});
