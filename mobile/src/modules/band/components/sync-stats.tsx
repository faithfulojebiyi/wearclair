import { CloudUpload, HardDrive } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { StatCard } from '@/ui/primitives/ui';
import { c, space } from '@/ui/theme/theme';

import { relativeTimeMs } from '../utils';

// the local-first pipeline gauges: on-device queue vs. synced-to-backend totals.
export const SyncStats = ({
  queued,
  syncedTotal,
  lastSyncTs,
  connected,
}: {
  queued: number;
  syncedTotal: number;
  lastSyncTs: number;
  connected: boolean;
}) => (
  <>
    <View style={styles.pipeRow}>
      <StatCard
        icon={HardDrive}
        label="On device"
        footer="unsynced samples"
        tint={queued > 0 ? c.warn : c.muted}
        value={queued.toLocaleString()}
      />
      <StatCard
        icon={CloudUpload}
        label="Synced"
        footer={lastSyncTs ? `last ${relativeTimeMs(lastSyncTs)}` : 'to backend'}
        tint={c.good}
        value={syncedTotal.toLocaleString()}
      />
    </View>
    <Text style={styles.syncLine}>
      {connected
        ? 'Auto-syncs every 8 seconds'
        : 'Connect the band to start streaming vitals'}
    </Text>
  </>
);

const styles = StyleSheet.create({
  pipeRow: { flexDirection: 'row', gap: space.gap },
  syncLine: { color: c.muted, fontSize: 13, textAlign: 'center' },
});
