import { Activity } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { HealthInsight } from '@/api/generated/wearclairAPI.schemas';
import { IconBox } from '@/ui/primitives/ui';
import { c, panel } from '@/ui/theme/theme';

import { INSIGHT_CATEGORY, relativeDays } from '../utils';

// a standard insight card in the feed.
export const FeedCard = ({ insight }: { insight: HealthInsight }) => {
  const meta = INSIGHT_CATEGORY[insight.category] ?? INSIGHT_CATEGORY.vitals;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <IconBox icon={meta.icon} size={34} tint={meta.tint} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{insight.title}</Text>
          <Text style={styles.cardTime}>{relativeDays(insight.date)}</Text>
        </View>
      </View>
      <Text style={styles.cardBody}>{insight.body}</Text>
      {insight.detail ? (
        <View style={styles.detailChip}>
          <Activity color={meta.tint} size={12} strokeWidth={2.4} />
          <Text style={[styles.detailText, { color: meta.tint }]}>
            {insight.detail}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: c.card,
    borderRadius: 20,
    gap: 10,
    padding: 16,
    shadowColor: '#8a6a4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  cardTitle: { color: c.ink, fontSize: 16, fontWeight: '700' },
  cardTime: { color: c.muted, fontSize: 12, marginTop: 2 },
  cardBody: { color: c.inkSoft, fontSize: 14, lineHeight: 21 },
  detailChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: panel[4],
    borderRadius: 8,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  detailText: { fontSize: 12, fontWeight: '600' },
});
