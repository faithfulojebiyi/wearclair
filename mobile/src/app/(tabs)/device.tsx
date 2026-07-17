import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  devicesControllerListDevices,
  devicesControllerRegisterDevice,
  devicesControllerSimulateSync,
} from '../../api/generated/devices/devices';
import { SyncResult } from '../../api/generated/wearclairAPI.schemas';
import { Card } from '../../components/ui';
import { signOut } from '../../lib/auth-client';
import { c, space } from '../../lib/theme';

export default function DeviceScreen() {
  const queryClient = useQueryClient();
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);

  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesControllerListDevices(),
  });

  const device = devices.data?.devices[0];

  const register = useMutation({
    mutationFn: () => devicesControllerRegisterDevice({ name: 'Clair Band' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  // the button drives the REAL pipeline: server-side generator -> ingest command ->
  // hypertable -> inngest -> worker insights. invalidating queries makes Today +
  // the charts visibly update right after.
  const sync = useMutation({
    mutationFn: (deviceId: string) => devicesControllerSimulateSync(deviceId),
    onSuccess: (result) => {
      setLastSync(result);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['biomarkers'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Device</Text>

        {devices.isLoading ? (
          <ActivityIndicator color={c.accent} />
        ) : device ? (
          <Card style={styles.card}>
            <View style={styles.deviceRow}>
              <View style={styles.deviceIcon}>
                <Ionicons color={c.accent} name="watch" size={26} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceModel}>{device.model}</Text>
              </View>
              <View style={styles.statusDot} />
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Last synced</Text>
              <Text style={styles.metaValue}>
                {device.lastSyncedAt
                  ? relativeTime(device.lastSyncedAt)
                  : 'never'}
              </Text>
            </View>

            <Pressable
              disabled={sync.isPending}
              onPress={() => sync.mutate(device.id)}
              style={({ pressed }) => [
                styles.syncButton,
                (pressed || sync.isPending) && styles.syncPressed,
              ]}
            >
              {sync.isPending ? (
                <ActivityIndicator color="#0E0E10" />
              ) : (
                <>
                  <Ionicons color="#0E0E10" name="sync" size={18} />
                  <Text style={styles.syncText}>Sync device</Text>
                </>
              )}
            </Pressable>

            {sync.isError ? (
              <Text style={styles.error}>
                {(sync.error as { response?: { data?: { message?: string } } })
                  ?.response?.data?.message ?? 'Sync failed'}
              </Text>
            ) : null}

            {lastSync ? (
              <View style={styles.result}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Accepted</Text>
                  <Text style={styles.resultValue}>
                    {lastSync.accepted.toLocaleString()} samples
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Window</Text>
                  <Text style={styles.resultValue}>
                    {formatTime(lastSync.windowStart)} →{' '}
                    {formatTime(lastSync.windowEnd)}
                  </Text>
                </View>
                <Text style={styles.resultBatch}>batch {lastSync.batchId}</Text>
              </View>
            ) : null}
          </Card>
        ) : (
          <Card style={styles.card}>
            <Text style={styles.emptyText}>No device paired yet.</Text>
            <Pressable
              disabled={register.isPending}
              onPress={() => register.mutate()}
              style={({ pressed }) => [
                styles.syncButton,
                (pressed || register.isPending) && styles.syncPressed,
              ]}
            >
              <Text style={styles.syncText}>Pair Clair Band</Text>
            </Pressable>
          </Card>
        )}

        <Card style={styles.explainCard}>
          <Text style={styles.explainTitle}>How this works</Text>
          <Text style={styles.explainer}>
            “Sync device” generates the next window of cycle-shaped sensor data
            server-side and pushes it through the real ingest path: TimescaleDB
            hypertable → Inngest event → worker-derived insights.
          </Text>
        </Card>

        <Pressable onPress={() => signOut()} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const relativeTime = (iso: string): string => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
};

const formatTime = (iso: string): string => {
  const date = new Date(iso);

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
  card: { gap: 16, padding: space.card },
  deviceRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  deviceIcon: {
    alignItems: 'center',
    backgroundColor: c.accentSoft,
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  deviceName: { color: c.text, fontSize: 18, fontWeight: '700' },
  deviceModel: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  statusDot: {
    backgroundColor: c.good,
    borderRadius: 5,
    height: 9,
    width: 9,
  },
  divider: { backgroundColor: c.border, height: StyleSheet.hairlineWidth },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { color: c.textMuted, fontSize: 14 },
  metaValue: { color: c.text, fontSize: 14, fontWeight: '600' },
  syncButton: {
    alignItems: 'center',
    backgroundColor: c.accent,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 15,
  },
  syncPressed: { opacity: 0.75 },
  syncText: { color: '#0E0E10', fontSize: 16, fontWeight: '700' },
  error: { color: c.accentText, fontSize: 13 },
  result: {
    backgroundColor: c.surface2,
    borderRadius: 14,
    gap: 8,
    padding: 14,
  },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between' },
  resultLabel: { color: c.textMuted, fontSize: 13 },
  resultValue: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  resultBatch: { color: c.textFaint, fontSize: 11, marginTop: 2 },
  emptyText: { color: c.textMuted, fontSize: 15 },
  explainCard: { backgroundColor: c.surface, gap: 8 },
  explainTitle: { color: c.textDim, fontSize: 14, fontWeight: '700' },
  explainer: { color: c.textMuted, fontSize: 13, lineHeight: 20 },
  signOut: { alignItems: 'center', padding: 10 },
  signOutText: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
});
