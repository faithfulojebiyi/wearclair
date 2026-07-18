import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { InnerCard } from '@/ui/primitives/ui';
import { HormoneKey, c, hormoneMeta } from '@/ui/theme/theme';

import { Hormones, Scope, buildHormoneChart } from '../hormone-chart';

const HORMONE_ORDER = Object.keys(hormoneMeta) as HormoneKey[];

// the multi-series hormone chart on the home phase card. builds the calendar-aligned
// series for the scope, then renders the line chart + custom axis + legend. renders
// nothing until there are at least two points.
export const HormoneChartCard = ({
  insights,
  scope,
  chartWidth,
}: {
  insights: { date: string; hormones: Hormones }[];
  scope: Scope;
  chartWidth: number;
}) => {
  const chart = buildHormoneChart(insights, scope);

  if (chart.est.length <= 1) {
    return null;
  }

  const ptSpacing = (chartWidth - 16) / Math.max(1, chart.slots - 1);

  // shared y-max across all four series (+15% headroom for the bezier overshoot) —
  // gifted-charts otherwise scales to the first series and clips the rest
  const chartMax =
    Math.max(
      1,
      ...chart.est.map((p) => p.value),
      ...chart.prog.map((p) => p.value),
      ...chart.lh.map((p) => p.value),
      ...chart.fsh.map((p) => p.value),
    ) * 1.15;

  return (
    <InnerCard style={styles.chartInner}>
      <LineChart
        curved
        data={chart.est.map((p) => ({ value: p.value }))}
        data2={chart.prog.map((p) => ({ value: p.value }))}
        data3={chart.lh.map((p) => ({ value: p.value }))}
        data4={chart.fsh.map((p) => ({ value: p.value }))}
        color={hormoneMeta.estradiolPgMl.color}
        color2={hormoneMeta.progesteroneNgMl.color}
        color3={hormoneMeta.lhMiuMl.color}
        color4={hormoneMeta.fshMiuMl.color}
        hideDataPoints
        hideRules
        hideYAxisText
        maxValue={chartMax}
        initialSpacing={8}
        endSpacing={8}
        spacing={ptSpacing}
        thickness={2.5}
        thickness2={2.5}
        thickness3={2}
        thickness4={2}
        width={chartWidth}
        xAxisColor={c.border}
        yAxisColor="transparent"
        yAxisLabelWidth={0}
        height={104}
      />
      <View style={[styles.axisRow, { width: chartWidth }]}>
        {chart.axis.map((tick) => (
          <Text
            key={`${tick.label}-${tick.slot}`}
            style={[styles.axisTick, { left: 8 + tick.slot * ptSpacing - 17 }]}
          >
            {tick.label}
          </Text>
        ))}
      </View>
      <View style={styles.chartLegend}>
        {HORMONE_ORDER.map((key) => (
          <LegendDot
            color={hormoneMeta[key].color}
            key={key}
            label={hormoneMeta[key].label}
          />
        ))}
      </View>
    </InnerCard>
  );
};

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  chartInner: { gap: 8, marginBottom: 12 },
  axisRow: { height: 14, position: 'relative' },
  axisTick: {
    color: c.muted,
    fontSize: 10,
    position: 'absolute',
    textAlign: 'center',
    width: 34,
  },
  chartLegend: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  legendDot: { borderRadius: 3, height: 6, width: 6 },
  legendText: { color: c.muted, fontSize: 12 },
});
