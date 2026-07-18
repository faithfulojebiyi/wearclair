import { StyleSheet, Text, View } from 'react-native';

import { StatCard, SectionTitle } from '@/ui/primitives/ui';
import { c, metricMeta, space } from '@/ui/theme/theme';

import { Reading } from '../use-live-readings';
import { METRIC_ICONS } from '../utils';

// the home "Vitals" section: a LIVE badge when streaming + a tile per reading.
export const VitalsTiles = ({
  readings,
  connected,
}: {
  readings: Reading[];
  connected: boolean;
}) => (
  <>
    <View style={styles.vitalsHead}>
      <SectionTitle>Vitals</SectionTitle>
      {connected ? (
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      ) : null}
    </View>
    <View style={styles.tiles}>
      {readings.map((reading) => {
        const meta = metricMeta[reading.metric];

        return (
          <StatCard
            icon={METRIC_ICONS[reading.metric]}
            key={reading.metric}
            label={meta.label}
            tint={meta.tint}
            unit={meta.unit}
            value={reading.value.toFixed(meta.decimals)}
          />
        );
      })}
    </View>
  </>
);

const styles = StyleSheet.create({
  vitalsHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveTag: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  liveDot: { backgroundColor: c.good, borderRadius: 3, height: 6, width: 6 },
  liveText: { color: c.good, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.gap },
});
