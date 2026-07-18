import { useRouter } from 'expo-router';
import { List } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayCard } from '@/modules/cycle/components/day-card';
import { MonthGrid } from '@/modules/cycle/components/month-grid';
import { useCycleCalendar } from '@/modules/cycle/queries/use-cycle-calendar';
import { useCycleDay } from '@/modules/cycle/queries/use-cycle-day';
import { MONTHS, buildDayMap, dayKey } from '@/modules/cycle/utils';
import { Segmented } from '@/ui/primitives/ui';
import { c, phaseMeta, serifBold, space } from '@/ui/theme/theme';

type Scope = 'month' | 'year';

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export default function CycleScreen() {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>('month');
  const now = new Date();
  const [selected, setSelected] = useState<string>(dayKey(now));

  // one wide window covers month + year views
  const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));

  const calendar = useCycleCalendar({ from, to }, now.getUTCFullYear());
  const day = useCycleDay(selected);

  const byDate = useMemo(
    () => buildDayMap(calendar.data?.days ?? []),
    [calendar.data],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.heading}>Cycle</Text>
          <Pressable
            hitSlop={12}
            onPress={() => router.push('/(tabs)/cycle/timeline')}
            style={styles.headerBtn}
          >
            <List color={c.ink} size={22} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.scopeRow}>
          <Segmented onChange={setScope} options={SCOPES} value={scope} />
        </View>

        {calendar.isLoading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
        ) : scope === 'month' ? (
          <>
            <View style={styles.card}>
              <MonthGrid
                byDate={byDate}
                month={now.getUTCMonth()}
                onSelect={setSelected}
                selected={selected}
                year={now.getUTCFullYear()}
              />
            </View>

            <DayCard
              chance={day.data?.fertilityChance ?? null}
              day={byDate.get(selected) ?? null}
              logs={day.data?.logs ?? []}
              onAddNote={() =>
                router.push({
                  pathname: '/(tabs)/cycle/track',
                  params: { date: selected },
                })
              }
              onEditPeriod={() => router.push('/(tabs)/cycle/edit-period')}
              selected={selected}
            />

            <View style={styles.legend}>
              <LegendItem color={c.accent} label="Period" />
              <LegendItem color={phaseMeta.FOLLICULAR.color} label="Fertile" />
              <LegendItem color={phaseMeta.OVULATORY.color} label="Ovulation" />
            </View>
          </>
        ) : (
          <View style={styles.yearGrid}>
            {MONTHS.map((_, m) => (
              <View key={m} style={styles.miniCard}>
                <Text style={styles.miniTitle}>{MONTHS[m].slice(0, 3)}</Text>
                <MonthGrid
                  byDate={byDate}
                  compact
                  month={m}
                  onSelect={setSelected}
                  selected={selected}
                  year={now.getUTCFullYear()}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { backgroundColor: c.bg, flex: 1 },
  container: {
    gap: space.gap,
    paddingBottom: 120,
    paddingHorizontal: space.screen,
    paddingTop: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heading: { color: c.ink, fontFamily: serifBold, fontSize: 28 },
  headerBtn: {
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    shadowColor: '#8a6a4a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    width: 40,
  },
  scopeRow: { marginBottom: 2 },
  card: {
    backgroundColor: c.card,
    borderRadius: 24,
    padding: 14,
    shadowColor: '#8a6a4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.gap },
  miniCard: {
    backgroundColor: c.card,
    borderRadius: 24,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 6,
    padding: 12,
    shadowColor: '#8a6a4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  miniTitle: { color: c.ink, fontSize: 13, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendText: { color: c.muted, fontSize: 13 },
});
