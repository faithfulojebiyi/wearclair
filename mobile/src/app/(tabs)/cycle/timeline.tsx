import { useRouter } from 'expo-router';
import { ChevronLeft, Droplet, Flower2, Plus, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATALOG_BY_KEY } from '@/modules/cycle/catalog';
import { useCycleTimeline } from '@/modules/cycle/queries/use-cycle-timeline';
import { dayKey } from '@/modules/cycle/utils';
import { IconBox } from '@/ui/primitives/ui';
import { c, panel, phaseMeta, serifBold, space } from '@/ui/theme/theme';

interface Entry {
  id: string;
  date: string;
  kind: string;
  label: string;
  detail: string | null;
}

const iconFor = (kind: string) =>
  kind.startsWith('period') ? Droplet : CATALOG_BY_KEY[kind]?.icon ?? Flower2;

const tintFor = (kind: string) =>
  kind.startsWith('period')
    ? c.accent
    : CATALOG_BY_KEY[kind]?.tint ?? phaseMeta.FOLLICULAR.color;

export default function TimelineScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const timeline = useCycleTimeline();

  const query = search.trim().toLowerCase();
  const entries: Entry[] = (timeline.data?.entries ?? []).filter((entry) =>
    query.length === 0
      ? true
      : `${entry.label} ${entry.detail ?? ''}`.toLowerCase().includes(query),
  );

  // consecutive entries on the same day share one date rail (entries come newest-first)
  const groups = useMemo(() => {
    const out: { key: string; date: Date; items: Entry[] }[] = [];

    for (const entry of entries) {
      const key = dayKey(new Date(entry.date));
      const last = out[out.length - 1];

      if (last && last.key === key) {
        last.items.push(entry);
      } else {
        out.push({ key, date: new Date(entry.date), items: [entry] });
      }
    }

    return out;
  }, [entries]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft color={c.ink} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title}>Timeline</Text>
        <Pressable
          hitSlop={12}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/cycle/track',
              params: { date: dayKey(new Date()) },
            })
          }
          style={styles.iconBtn}
        >
          <Plus color={c.ink} size={24} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Search color={c.muted} size={18} strokeWidth={2.2} />
        <TextInput
          onChangeText={setSearch}
          placeholder="Search entries"
          placeholderTextColor={c.faint}
          style={styles.searchInput}
          value={search}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {timeline.isLoading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
        ) : groups.length === 0 ? (
          <Text style={styles.emptyText}>
            {query.length > 0 ? 'No matching entries.' : 'No cycle events yet.'}
          </Text>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={styles.row}>
              <View style={styles.rail}>
                <Text style={styles.railDay}>{group.date.getUTCDate()}</Text>
                <Text style={styles.railMonth}>
                  {group.date.toLocaleDateString(undefined, {
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                </Text>
                <Text style={styles.railWeekday}>
                  {group.date.toLocaleDateString(undefined, {
                    weekday: 'short',
                    timeZone: 'UTC',
                  })}
                </Text>
              </View>

              <View style={styles.cards}>
                {group.items.map((entry) => (
                  <View key={entry.id} style={styles.card}>
                    <IconBox
                      icon={iconFor(entry.kind)}
                      size={38}
                      tint={tintFor(entry.kind)}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>{entry.label}</Text>
                      {entry.detail ? (
                        <Text style={styles.detail}>{entry.detail}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: c.bg, flex: 1 },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.screen,
    paddingVertical: 8,
  },
  iconBtn: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  title: { color: c.ink, fontFamily: serifBold, fontSize: 20 },
  searchBox: {
    alignItems: 'center',
    backgroundColor: panel[4],
    borderRadius: 13,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: space.screen,
    paddingHorizontal: 14,
  },
  searchInput: { color: c.ink, flex: 1, fontSize: 15, paddingVertical: 11 },
  container: {
    gap: space.gap,
    paddingBottom: 40,
    paddingHorizontal: space.screen,
    paddingTop: space.gap,
  },
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', paddingTop: 10, width: 44 },
  railDay: {
    color: c.accentText,
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  railMonth: {
    color: c.inkSoft,
    fontSize: 13,
    fontWeight: '700',
    marginTop: -2,
  },
  railWeekday: { color: c.muted, fontSize: 11, marginTop: 1 },
  cards: { flex: 1, gap: 8 },
  card: {
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    shadowColor: '#8a6a4a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  label: { color: c.ink, fontSize: 15, fontWeight: '600' },
  detail: { color: c.muted, fontSize: 13, marginTop: 2 },
  emptyText: { color: c.muted, fontSize: 14, marginTop: 40, textAlign: 'center' },
});
