import { Pressable, StyleSheet, Text, View } from 'react-native';

import { c } from '@/ui/theme/theme';

import { WEEKDAYS, dayKey } from '../utils';

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

// tap-to-toggle month grid for the Edit-period screen: a filled pill marks a selected
// period day. week rows keep the columns aligned with the header.
export const EditableMonth = ({
  year,
  month,
  selected,
  onToggle,
}: {
  year: number;
  month: number;
  selected: Set<string>;
  onToggle: (key: string) => void;
}) => {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View>
      <View style={styles.week}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      {toWeeks(cells).map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((dayNum, i) => {
            if (dayNum === null) {
              return <View key={i} style={styles.cell} />;
            }

            const key = dayKey(new Date(Date.UTC(year, month, dayNum)));
            const isOn = selected.has(key);

            return (
              <Pressable key={i} onPress={() => onToggle(key)} style={styles.cell}>
                <View style={[styles.dayInner, isOn && styles.dayInnerOn]}>
                  <Text style={[styles.cellText, isOn && styles.cellTextOn]}>
                    {dayNum}
                  </Text>
                </View>
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
    marginBottom: 2,
    textAlign: 'center',
  },
  cell: {
    alignItems: 'center',
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  dayInner: {
    alignItems: 'center',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  dayInnerOn: { backgroundColor: c.accent },
  cellText: { color: c.ink, fontSize: 15, fontVariant: ['tabular-nums'] },
  cellTextOn: { color: c.onAccent, fontWeight: '700' },
});
