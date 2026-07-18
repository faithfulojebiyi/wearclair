import { ArrowRight } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Card, IconBox, InnerCard } from '@/ui/primitives/ui';
import { c } from '@/ui/theme/theme';

// static explainer describing the local-first → cloud data pipeline.
export const PipelineExplainer = () => (
  <Card>
    <View style={styles.explainHead}>
      <IconBox icon={ArrowRight} size={30} tint={c.accent} />
      <Text style={styles.explainTitle}>Local-first pipeline</Text>
    </View>
    <InnerCard>
      <Text style={styles.explainer}>
        The band streams vitals to the phone over BLE and they land in an on-device
        store first — reactive and offline-capable. A background engine then syncs the
        unsynced queue to the backend (TimescaleDB hypertable → Inngest → worker-derived
        insights). Your data lives on your device; the cloud only ever sees synced
        batches.
      </Text>
    </InnerCard>
  </Card>
);

const styles = StyleSheet.create({
  explainHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  explainTitle: { color: c.ink, fontSize: 15, fontWeight: '700' },
  explainer: { color: c.inkSoft, fontSize: 13, lineHeight: 20 },
});
