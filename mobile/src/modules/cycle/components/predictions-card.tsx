import { Droplets, Egg, Flower2, LucideIcon, Sparkles } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CyclePredictions } from '@/api/generated/wearclairAPI.schemas';
import { Card, CardHeader, IconBox, InnerCard } from '@/ui/primitives/ui';
import { c, panel } from '@/ui/theme/theme';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// the home "Your cycle ahead" card — ovulation, next period, fertile window.
export const PredictionsCard = ({
  predictions,
}: {
  predictions: CyclePredictions | undefined;
}) => (
  <Card>
    <CardHeader icon={Sparkles} tint={c.accent} title="Your cycle ahead" />
    {predictions ? (
      <InnerCard style={styles.predInner}>
        <PredRow
          icon={Egg}
          tint="#C98B2D"
          label="Ovulation"
          value={
            predictions.ovulation.inDays === 0
              ? 'Today'
              : `In ${predictions.ovulation.inDays} days`
          }
        />
        <View style={styles.predDivider} />
        <PredRow
          icon={Droplets}
          tint="#B85C6E"
          label="Next Period"
          value={shortDate(predictions.nextPeriod.date)}
        />
        <View style={styles.predDivider} />
        <PredRow
          icon={Flower2}
          tint="#4E9B6F"
          label="Fertile Window"
          value={
            predictions.fertileWindow.active
              ? `Now – ${shortDate(predictions.fertileWindow.end)}`
              : `From ${shortDate(predictions.fertileWindow.start)}`
          }
        />
      </InnerCard>
    ) : (
      <ActivityIndicator color={c.accent} />
    )}
  </Card>
);

const PredRow = ({
  icon,
  tint,
  label,
  value,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  value: string;
}) => (
  <View style={styles.predRow}>
    <IconBox icon={icon} size={34} tint={tint} />
    <Text style={styles.predLabel}>{label}</Text>
    <Text style={styles.predValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  predInner: { gap: 12 },
  predRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  predLabel: { color: c.ink, flex: 1, fontSize: 15, fontWeight: '600' },
  predValue: { color: c.inkSoft, fontSize: 14, fontWeight: '600' },
  predDivider: { backgroundColor: panel[8], height: 1, marginLeft: 46 },
});
