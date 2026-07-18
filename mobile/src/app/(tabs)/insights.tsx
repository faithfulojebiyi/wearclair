import { Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedCard } from '@/modules/insights/components/feed-card';
import { HeroCard } from '@/modules/insights/components/hero-card';
import { useHealthInsights } from '@/modules/insights/queries/use-health-insights';
import { c, serifBold, space } from '@/ui/theme/theme';

export default function InsightsScreen() {
  const feed = useHealthInsights(30);

  const insights = feed.data?.insights ?? [];
  const [hero, ...rest] = insights;

  // dedicated pull-to-refresh state (not feed.isRefetching, which flips on every
  // background refetch and makes the page jump)
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await feed.refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={c.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.heading}>Health Insights</Text>
          <Text style={styles.sub}>Decoded from your latest sync</Text>
        </View>

        {feed.isLoading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
        ) : insights.length === 0 ? (
          <View style={styles.empty}>
            <Sparkles color={c.faint} size={28} />
            <Text style={styles.emptyText}>
              No insights yet — connect your band to decode your cycle.
            </Text>
          </View>
        ) : (
          <>
            {hero ? <HeroCard insight={hero} /> : null}
            {rest.map((insight) => (
              <FeedCard insight={insight} key={insight.id} />
            ))}
          </>
        )}
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
  header: { marginBottom: 4 },
  heading: { color: c.ink, fontFamily: serifBold, fontSize: 28 },
  sub: { color: c.muted, fontSize: 14, marginTop: 3 },
  empty: { alignItems: 'center', gap: 12, marginTop: 60, paddingHorizontal: 30 },
  emptyText: { color: c.muted, fontSize: 15, textAlign: 'center' },
});
