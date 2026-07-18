import { StyleSheet, Text, View } from 'react-native';

import { HealthInsight } from '@/api/generated/wearclairAPI.schemas';
import { c, panel } from '@/ui/theme/theme';

import { INSIGHT_CATEGORY, relativeDays } from '../utils';

// the lead insight — accent-filled when high priority.
export const HeroCard = ({ insight }: { insight: HealthInsight }) => {
  const meta = INSIGHT_CATEGORY[insight.category] ?? INSIGHT_CATEGORY.vitals;
  const Icon = meta.icon;
  const isHigh = insight.priority === 'high';

  return (
    <View style={[styles.hero, isHigh && styles.heroHigh]}>
      <View style={styles.heroTop}>
        <View style={styles.heroIcon}>
          <Icon color={isHigh ? c.onAccent : c.accent} size={18} strokeWidth={2.2} />
        </View>
        {isHigh ? (
          <View style={styles.priorityTag}>
            <Text style={styles.priorityText}>HIGH PRIORITY</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.heroTitle, isHigh && styles.heroTitleHigh]}>
        {insight.title}
      </Text>
      <Text style={[styles.heroBody, isHigh && styles.heroBodyHigh]}>
        {insight.body}
      </Text>
      {insight.detail ? (
        <Text style={[styles.heroDetail, isHigh && styles.heroDetailHigh]}>
          {insight.detail}
        </Text>
      ) : null}
      <Text style={[styles.heroTime, isHigh && styles.heroTimeHigh]}>
        {relativeDays(insight.date)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: {
    backgroundColor: c.card,
    borderRadius: 22,
    gap: 8,
    padding: 20,
    shadowColor: '#8a6a4a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  heroHigh: { backgroundColor: c.accent },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: panel[6],
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  priorityTag: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priorityText: {
    color: c.onAccent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: { color: c.ink, fontSize: 20, fontWeight: '700' },
  heroTitleHigh: { color: c.onAccent },
  heroBody: { color: c.inkSoft, fontSize: 15, lineHeight: 22 },
  heroBodyHigh: { color: 'rgba(255,255,255,0.92)' },
  heroDetail: { color: c.accentText, fontSize: 13, fontWeight: '600', marginTop: 2 },
  heroDetailHigh: { color: c.onAccent },
  heroTime: { color: c.faint, fontSize: 12, marginTop: 4 },
  heroTimeHigh: { color: 'rgba(255,255,255,0.75)' },
});
