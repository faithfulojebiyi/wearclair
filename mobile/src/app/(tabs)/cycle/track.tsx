import { useLocalSearchParams, useRouter } from 'expo-router';
import { Sliders, X } from 'lucide-react-native';
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

import { CycleLog } from '@/api/generated/wearclairAPI.schemas';
import { CategoryBlock } from '@/modules/cycle/components/category-block';
import { WeekStrip } from '@/modules/cycle/components/week-strip';
import { useUpsertDayLog } from '@/modules/cycle/mutations/use-upsert-day-log';
import { useCycleDay } from '@/modules/cycle/queries/use-cycle-day';
import { useVisibleCategories } from '@/modules/cycle/prefs';
import { MONTHS, dayKey } from '@/modules/cycle/utils';
import { c, serifBold, space } from '@/ui/theme/theme';

import { Category } from '@/modules/cycle/catalog';

// month (+ year when not the current year) label for the header
const monthLabelFor = (key: string): string => {
  const d = new Date(`${key}T00:00:00Z`);

  return d.getUTCFullYear() === new Date().getUTCFullYear()
    ? MONTHS[d.getUTCMonth()]
    : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const DayLogEditor = ({
  categories,
  date,
  logs,
  onMore,
}: {
  categories: Category[];
  date: string;
  logs: CycleLog[];
  onMore: () => void;
}) => {
  const upsert = useUpsertDayLog(date);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(logs.map((log) => [log.type, log.value])),
  );

  const commit = (type: string, value: string) => {
    setValues((previous) => ({ ...previous, [type]: value }));
    upsert.mutate({ type, value });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {categories.map((category) => (
        <CategoryBlock
          category={category}
          key={category.key}
          onChange={(value) => commit(category.key, value)}
          value={values[category.key] ?? ''}
        />
      ))}

      <Pressable onPress={onMore} style={styles.moreBtn}>
        <Sliders color={c.accentText} size={16} strokeWidth={2.2} />
        <Text style={styles.moreText}>More parameters</Text>
      </Pressable>
    </ScrollView>
  );
};

export default function TrackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const categories = useVisibleCategories();

  const [date, setDate] = useState<string>(params.date ?? dayKey(new Date()));
  const [monthLabel, setMonthLabel] = useState(() => monthLabelFor(date));

  const selectDay = (key: string) => {
    setDate(key);
    setMonthLabel(monthLabelFor(key));
  };

  const day = useCycleDay(date);

  const headerLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString(
    undefined,
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    },
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <X color={c.ink} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title}>{monthLabel}</Text>
        <Pressable
          hitSlop={12}
          onPress={() => router.push('/(tabs)/cycle/parameters')}
          style={styles.iconBtn}
        >
          <Sliders color={c.ink} size={22} strokeWidth={2.2} />
        </Pressable>
      </View>

      <WeekStrip
        onMonthChange={setMonthLabel}
        onSelect={selectDay}
        selected={date}
      />

      <Text style={styles.dateLabel}>{headerLabel}</Text>

      {day.isLoading || !day.data ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <DayLogEditor
          categories={categories}
          date={date}
          key={date}
          logs={day.data.logs}
          onMore={() => router.push('/(tabs)/cycle/parameters')}
        />
      )}
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
  iconBtn: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  title: { color: c.ink, fontFamily: serifBold, fontSize: 20 },
  dateLabel: {
    color: c.ink,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: space.screen,
    paddingTop: 4,
  },
  container: {
    gap: space.gap,
    paddingBottom: 60,
    paddingHorizontal: space.screen,
    paddingTop: space.gap,
  },
  moreBtn: {
    alignItems: 'center',
    backgroundColor: c.accentSoft,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  moreText: { color: c.accentText, fontSize: 14, fontWeight: '700' },
});
