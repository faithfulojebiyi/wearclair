import { LogOut } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRowIds, useValue } from 'tinybase/ui-react';

import { useSession } from '@/modules/auth/auth-client';
import { performSignOut } from '@/modules/auth/sign-out';
import { connectBand, disconnectBand } from '@/modules/band/band';
import { DeviceCard } from '@/modules/band/components/device-card';
import { PipelineExplainer } from '@/modules/band/components/pipeline-explainer';
import { SyncIssues } from '@/modules/band/components/sync-issues';
import { SyncStats } from '@/modules/band/components/sync-stats';
import {
  QUEUE_TABLE,
  SYNC_ISSUES_TABLE,
  discardSyncIssues,
  retrySyncIssues,
} from '@/modules/band/local-store';
import { useRegisterDevice } from '@/modules/band/mutations/use-register-device';
import { useDevices } from '@/modules/band/queries/use-devices';
import { Card, InnerCard } from '@/ui/primitives/ui';
import { c, serifBold, space } from '@/ui/theme/theme';

export default function DeviceScreen() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const connected = Boolean(useValue('connected'));
  const queued = useRowIds(QUEUE_TABLE).length;
  const issueCount = useRowIds(SYNC_ISSUES_TABLE).length;
  const lastSyncTs = Number(useValue('lastSyncTs') ?? 0);
  const syncedTotal = Number(useValue('syncedTotal') ?? 0);
  const syncPauseValue = useValue('syncPauseReason');
  const syncPauseReason =
    syncPauseValue === 'auth' || syncPauseValue === 'device'
      ? syncPauseValue
      : undefined;

  const devices = useDevices();
  const device = devices.data?.devices[0];
  const register = useRegisterDevice();

  const toggle = () => {
    if (connected) {
      disconnectBand();
    } else if (userId) {
      connectBand(userId);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Profile</Text>

        {devices.isLoading ? (
          <ActivityIndicator color={c.accent} />
        ) : device ? (
          <>
            <DeviceCard
              connected={connected}
              device={device}
              lastSyncTs={lastSyncTs}
              onToggle={toggle}
            />
            <SyncStats
              connected={connected}
              lastSyncTs={lastSyncTs}
              queued={queued}
              syncedTotal={syncedTotal}
            />
          </>
        ) : (
          <Card>
            <InnerCard style={styles.emptyInner}>
              <Text style={styles.emptyText}>No band paired yet.</Text>
            </InnerCard>
            <Pressable
              disabled={register.isPending}
              onPress={() => register.mutate()}
              style={({ pressed }) => [
                styles.connectButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.connectText}>Pair Clair Band</Text>
            </Pressable>
          </Card>
        )}

        <SyncIssues
          issueCount={issueCount}
          onDiscard={discardSyncIssues}
          onRetry={retrySyncIssues}
          pauseReason={syncPauseReason}
        />

        <PipelineExplainer />

        <Pressable
          onPress={() => void performSignOut()}
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.6 }]}
        >
          <LogOut color={c.muted} size={16} strokeWidth={2.2} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
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
  emptyInner: { marginBottom: 12 },
  emptyText: { color: c.muted, fontSize: 15 },
  connectButton: {
    alignItems: 'center',
    backgroundColor: c.accent,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 15,
  },
  pressed: { opacity: 0.75 },
  connectText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
  signOut: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  signOutText: { color: c.muted, fontSize: 14, fontWeight: '600' },
});
