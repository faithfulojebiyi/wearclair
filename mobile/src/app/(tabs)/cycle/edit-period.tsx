import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditableMonth } from '@/modules/cycle/components/editable-month';
import { useSetPeriod } from '@/modules/cycle/mutations/use-set-period';
import { useCycleCalendar } from '@/modules/cycle/queries/use-cycle-calendar';
import { MONTHS, dayKey, toIso } from '@/modules/cycle/utils';
import { c, panel, serifBold, space } from '@/ui/theme/theme';

// the editable window: the current month and the previous three
const MONTHS_BACK = 3;

export default function EditPeriodScreen() {
  const router = useRouter();
  const now = new Date();

  const window = useMemo(() => {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const from = new Date(Date.UTC(y, m - MONTHS_BACK, 1));
    const to = new Date(Date.UTC(y, m + 1, 0));
    const months: { year: number; month: number }[] = [];

    for (let i = MONTHS_BACK; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(y, m - i, 1));
      months.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
    }

    return { from, to, months };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calendar = useCycleCalendar(
    { from: window.from, to: window.to },
    'edit',
  );
  const save = useSetPeriod();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState(false);

  // seed the selection from the currently-logged/derived period days (past only)
  useEffect(() => {
    if (seeded || !calendar.data) {
      return;
    }

    const initial = new Set<string>();

    for (const d of calendar.data.days) {
      if (d.isPeriod && !d.isPredicted) {
        initial.add(dayKey(new Date(d.date)));
      }
    }

    setSelected(initial);
    setSeeded(true);
  }, [calendar.data, seeded]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const onSave = () => {
    save.mutate(
      {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        dates: [...selected].map(toIso),
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.iconBtn}>
          <X color={c.ink} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title}>Edit period</Text>
        <View style={styles.iconBtn} />
      </View>

      <Text style={styles.hint}>Tap a date to adjust your period days.</Text>

      {calendar.isLoading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {window.months.map(({ year, month }) => (
            <View key={`${year}-${month}`} style={styles.monthBlock}>
              <Text style={styles.monthTitle}>
                {MONTHS[month]} {year}
              </Text>
              <EditableMonth
                month={month}
                onToggle={toggle}
                selected={selected}
                year={year}
              />
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Pressable
          disabled={save.isPending}
          onPress={onSave}
          style={({ pressed }) => [
            styles.saveBtn,
            (pressed || save.isPending) && styles.saveBtnPressed,
          ]}
        >
          {save.isPending ? (
            <ActivityIndicator color={c.onAccent} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
      </View>
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
  hint: {
    color: c.muted,
    fontSize: 14,
    paddingBottom: 8,
    paddingHorizontal: space.screen,
  },
  container: {
    gap: space.gap,
    paddingBottom: 24,
    paddingHorizontal: space.screen,
    paddingTop: 4,
  },
  monthBlock: {
    backgroundColor: c.card,
    borderRadius: 24,
    gap: 8,
    padding: 14,
    shadowColor: '#8a6a4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  monthTitle: { color: c.ink, fontSize: 16, fontWeight: '700' },
  footer: {
    backgroundColor: c.bg,
    borderTopColor: panel[6],
    borderTopWidth: 1,
    paddingBottom: 28,
    paddingHorizontal: space.screen,
    paddingTop: 12,
  },
  saveBtn: {
    alignItems: 'center',
    backgroundColor: c.accent,
    borderRadius: 14,
    paddingVertical: 15,
  },
  saveBtnPressed: { opacity: 0.75 },
  saveText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
});
