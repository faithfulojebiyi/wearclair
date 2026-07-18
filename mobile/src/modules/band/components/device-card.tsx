import { Bluetooth, Square, Watch } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Device } from '@/api/generated/wearclairAPI.schemas';
import { Card, IconBox, InnerCard } from '@/ui/primitives/ui';
import { c, panel } from '@/ui/theme/theme';

import { relativeTimeMs } from '../utils';

// the profile band card: identity, live/offline status, last sync, connect toggle.
export const DeviceCard = ({
  device,
  connected,
  lastSyncTs,
  onToggle,
}: {
  device: Device;
  connected: boolean;
  lastSyncTs: number;
  onToggle: () => void;
}) => (
  <Card>
    <View style={styles.deviceRow}>
      <IconBox icon={Watch} size={44} tint={connected ? c.good : c.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.deviceName}>{device.name}</Text>
        <Text style={styles.deviceModel}>{device.model}</Text>
      </View>
      <View style={styles.statusChip}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: connected ? c.good : c.faint },
          ]}
        />
        <Text style={[styles.statusText, { color: connected ? c.good : c.muted }]}>
          {connected ? 'Streaming' : 'Offline'}
        </Text>
      </View>
    </View>

    <InnerCard style={styles.metaInner}>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Last synced</Text>
        <Text style={styles.metaValue}>
          {lastSyncTs
            ? relativeTimeMs(lastSyncTs)
            : device.lastSyncedAt
              ? 'earlier'
              : 'never'}
        </Text>
      </View>
    </InnerCard>

    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.connectButton,
        connected && styles.disconnectButton,
        pressed && styles.pressed,
      ]}
    >
      {connected ? (
        <Square color={c.ink} fill={c.ink} size={14} />
      ) : (
        <Bluetooth color={c.onAccent} size={18} />
      )}
      <Text style={[styles.connectText, connected && styles.disconnectText]}>
        {connected ? 'Disconnect band' : 'Connect band'}
      </Text>
    </Pressable>
  </Card>
);

const styles = StyleSheet.create({
  deviceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  deviceName: { color: c.ink, fontSize: 18, fontWeight: '700' },
  deviceModel: { color: c.muted, fontSize: 13, marginTop: 2 },
  statusChip: {
    alignItems: 'center',
    backgroundColor: panel[4],
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusDot: { borderRadius: 4, height: 8, width: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  metaInner: { marginBottom: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { color: c.muted, fontSize: 14 },
  metaValue: { color: c.ink, fontSize: 14, fontWeight: '600' },
  connectButton: {
    alignItems: 'center',
    backgroundColor: c.accent,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 15,
  },
  disconnectButton: { backgroundColor: panel[6] },
  pressed: { opacity: 0.75 },
  connectText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
  disconnectText: { color: c.ink },
});
