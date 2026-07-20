import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
  useWindowDimensions,
} from 'react-native';

import { c, space } from '@/ui/theme/theme';

import { MONTHS, WEEKDAYS, dayKey } from '../utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_WEEKS = 10; // scroll room behind the earliest of today/selected

const startOfDayUtc = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

// horizontally-scrollable day strip (one week fills the width). reports the month of
// whatever's centered so the screen header can show it, like the reference tracker.
export const WeekStrip = ({
  selected,
  onSelect,
  onMonthChange,
}: {
  selected: string;
  onSelect: (key: string) => void;
  onMonthChange: (label: string) => void;
}) => {
  const { width } = useWindowDimensions();
  const itemWidth = (width - space.screen * 2) / 7;

  const todayKey = dayKey(new Date());

  // the initial selection anchors the range; kept in state so the day list is stable
  // as the selection changes (tapping a visible day shouldn't rebuild/rescroll it).
  const [initialSelected] = useState(selected);

  const days = useMemo(() => {
    const sel = new Date(`${initialSelected}T00:00:00Z`);
    const now = startOfDayUtc(new Date());
    const lo = new Date(Math.min(sel.getTime(), now.getTime()));
    const hi = new Date(Math.max(sel.getTime(), now.getTime()));

    // pad back to a Sunday PAST_WEEKS before the earliest, forward to hi's Saturday
    const start = new Date(
      lo.getTime() - (lo.getUTCDay() + PAST_WEEKS * 7) * DAY_MS,
    );
    const end = new Date(hi.getTime() + (6 - hi.getUTCDay()) * DAY_MS);
    const count = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;

    return Array.from(
      { length: count },
      (_, i) => new Date(start.getTime() + i * DAY_MS),
    );
  }, [initialSelected]);

  const initialIndex = Math.max(
    0,
    days.findIndex((d) => dayKey(d) === initialSelected),
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: itemWidth,
      offset: itemWidth * index,
      index,
    }),
    [itemWidth],
  );

  // report the centered month up to the header
  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const mid = viewableItems[Math.floor(viewableItems.length / 2)];
      const date = mid?.item as Date | undefined;

      if (date) {
        const label =
          date.getUTCFullYear() === new Date().getUTCFullYear()
            ? MONTHS[date.getUTCMonth()]
            : `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

        onMonthChange(label);
      }
    },
    [onMonthChange],
  );

  const viewabilityPairs = useMemo(
    () => [
      {
        viewabilityConfig: { itemVisiblePercentThreshold: 50 },
        onViewableItemsChanged: onViewable,
      },
    ],
    [onViewable],
  );

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={days}
      extraData={selected}
      getItemLayout={getItemLayout}
      horizontal
      initialScrollIndex={initialIndex}
      keyExtractor={(d) => dayKey(d)}
      onScrollToIndexFailed={() => undefined}
      renderItem={({ item }) => {
        const key = dayKey(item);
        const active = key === selected;
        const isToday = key === todayKey;

        return (
          <Pressable
            onPress={() => onSelect(key)}
            style={[styles.dayBtn, { width: itemWidth }]}
          >
            <Text
              numberOfLines={1}
              style={[styles.dayName, isToday && styles.todayName]}
            >
              {isToday ? 'TODAY' : WEEKDAYS[item.getUTCDay()]}
            </Text>
            <View style={[styles.dayNum, active && styles.dayNumOn]}>
              <Text style={[styles.dayNumText, active && styles.dayNumTextOn]}>
                {item.getUTCDate()}
              </Text>
            </View>
          </Pressable>
        );
      }}
      showsHorizontalScrollIndicator={false}
      viewabilityConfigCallbackPairs={viewabilityPairs}
    />
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: space.screen,
    paddingVertical: 12,
  },
  dayBtn: { alignItems: 'center', gap: 8, justifyContent: 'center' },
  dayName: { color: c.muted, fontSize: 12, fontWeight: '600' },
  todayName: { color: c.accent, fontWeight: '700' },
  dayNum: {
    alignItems: 'center',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dayNumOn: { backgroundColor: c.accent },
  dayNumText: { color: c.ink, fontSize: 15, fontVariant: ['tabular-nums'] },
  dayNumTextOn: { color: c.onAccent, fontWeight: '700' },
});
