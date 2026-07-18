import { StyleSheet, Text, View } from 'react-native';

import { InnerCard } from '@/ui/primitives/ui';
import { HormoneKey, c, hormoneMeta, panel } from '@/ui/theme/theme';

import { Hormones } from '../hormone-chart';

const HORMONE_ORDER = Object.keys(hormoneMeta) as HormoneKey[];

// the four estimated-hormone value cells (label + fill bar + reading) under the chart.
export const HormoneGrid = ({ hormones }: { hormones: Hormones }) => (
  <View style={styles.grid}>
    {HORMONE_ORDER.map((key) => {
      const meta = hormoneMeta[key];
      const value = hormones[key];
      const fill = Math.min(1, value / meta.max);

      return (
        <InnerCard key={key} style={styles.cell}>
          <View style={styles.head}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text style={styles.label}>{meta.label}</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { backgroundColor: meta.color, width: `${Math.max(4, fill * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.value}>
            {value.toFixed(meta.decimals)}
            <Text style={styles.unit}> {meta.unit}</Text>
          </Text>
        </InnerCard>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { flexBasis: '47%', flexGrow: 1, gap: 8, padding: 12 },
  head: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  dot: { borderRadius: 3, height: 6, width: 6 },
  label: { color: c.inkSoft, fontSize: 13, fontWeight: '600' },
  barTrack: {
    backgroundColor: panel[8],
    borderRadius: 3,
    height: 6,
    overflow: 'hidden',
  },
  barFill: { borderRadius: 3, height: 6 },
  value: {
    color: c.ink,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unit: { color: c.muted, fontSize: 12, fontWeight: '500' },
});
