import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CycleDay } from '@/api/generated/wearclairAPI.schemas';
import { c, phaseMeta } from '@/ui/theme/theme';

import { WEEKDAYS, dayKey } from '../utils';

// split a flat cell list into padded rows of 7 so each week is a flex row (columns
// stay aligned with the weekday header; avoids the percentage-width rounding that
// dropped the 7th column).
const toWeeks = (cells: (number | null)[]): (number | null)[][] => {
  const weeks: (number | null)[][] = [];

  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);

    while (week.length < 7) {
      week.push(null);
    }

    weeks.push(week);
  }

  return weeks;
};

// read-only month grid: period/fertile/ovulation dots, a selected pill, dimmed
// predicted days. `compact` renders the year-view miniatures.
export const MonthGrid = ({
  year,
  month,
  byDate,
  selected,
  onSelect,
  compact,
}: {
  year: number;
  month: number;
  byDate: Map<string, CycleDay>;
  selected: string;
  onSelect: (key: string) => void;
  compact?: boolean;
}) => {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const cellStyle = compact ? styles.cellCompact : styles.cell;
  const textStyle = compact ? styles.cellTextCompact : styles.cellText;

  return (
    <View>
      {!compact ? (
        <View style={styles.week}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>
      ) : null}

      {toWeeks(cells).map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((dayNum, i) => {
            if (dayNum === null) {
              return <View key={i} style={cellStyle} />;
            }

            const date = new Date(Date.UTC(year, month, dayNum));
            const key = dayKey(date);
            const day = byDate.get(key);
            const isSelected = key === selected;

            const dot = day?.isPeriod
              ? c.accent
              : day?.isOvulation
                ? phaseMeta.OVULATORY.color
                : day?.isFertile
                  ? phaseMeta.FOLLICULAR.color
                  : null;

            return (
              <Pressable
                key={i}
                onPress={() => onSelect(key)}
                style={[
                  cellStyle,
                  isSelected && styles.cellSelected,
                  day?.isPredicted && styles.cellPredicted,
                ]}
              >
                <Text
                  style={[
                    textStyle,
                    isSelected && styles.cellTextSelected,
                    day?.isPeriod && !isSelected && { color: c.accent },
                  ]}
                >
                  {dayNum}
                </Text>
                {dot ? (
                  <View
                    style={[
                      compact ? styles.dotCompact : styles.dot,
                      { backgroundColor: dot },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  weekday: {
    color: c.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  cell: {
    alignItems: 'center',
    aspectRatio: 1,
    flex: 1,
    justifyContent: 'center',
  },
  cellCompact: {
    alignItems: 'center',
    flex: 1,
    height: 18,
    justifyContent: 'center',
  },
  cellSelected: { backgroundColor: c.accent, borderRadius: 12 },
  cellPredicted: { opacity: 0.5 },
  cellText: { color: c.ink, fontSize: 15, fontVariant: ['tabular-nums'] },
  cellTextCompact: { color: c.ink, fontSize: 9 },
  cellTextSelected: { color: c.onAccent, fontWeight: '700' },
  dot: {
    borderRadius: 2.5,
    bottom: 5,
    height: 5,
    position: 'absolute',
    width: 5,
  },
  dotCompact: {
    borderRadius: 1.5,
    bottom: 1,
    height: 3,
    position: 'absolute',
    width: 3,
  },
});
