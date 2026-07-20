import { AlertTriangle } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, CardHeader, InnerCard } from '@/ui/primitives/ui';
import { c, panel } from '@/ui/theme/theme';

export const SyncIssues = ({
  issueCount,
  pauseReason,
  onRetry,
  onDiscard,
}: {
  issueCount: number;
  pauseReason: 'auth' | 'device' | undefined;
  onRetry: () => void;
  onDiscard: () => void;
}) => {
  if (issueCount === 0 && !pauseReason) {
    return null;
  }

  const pauseMessage =
    pauseReason === 'auth'
      ? 'Sync is paused while your session is refreshed.'
      : pauseReason === 'device'
        ? 'Sync is paused because this band is no longer registered.'
        : undefined;

  return (
    <Card>
      <CardHeader
        icon={AlertTriangle}
        tint={c.warn}
        title="Sync needs attention"
      />
      <InnerCard>
        {pauseMessage ? (
          <Text style={styles.message}>{pauseMessage}</Text>
        ) : null}
        {issueCount > 0 ? (
          <>
            <Text style={styles.message}>
              {issueCount.toLocaleString()} rejected{' '}
              {issueCount === 1 ? 'reading is' : 'readings are'} stored on this
              device.
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={onRetry}
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
              <Pressable
                onPress={onDiscard}
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.discardText}>Discard</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </InnerCard>
    </Card>
  );
};

const styles = StyleSheet.create({
  message: { color: c.inkSoft, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: {
    backgroundColor: panel[5],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pressed: { opacity: 0.65 },
  retryText: { color: c.accentText, fontSize: 14, fontWeight: '700' },
  discardText: { color: c.muted, fontSize: 14, fontWeight: '600' },
});
