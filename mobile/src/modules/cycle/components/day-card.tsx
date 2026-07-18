import { CalendarPlus, Pencil, Sparkles } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CycleDay } from '@/api/generated/wearclairAPI.schemas';
import { Card, IconBox } from '@/ui/primitives/ui';
import { c, panel, phaseMeta } from '@/ui/theme/theme';

import { CATALOG_BY_KEY } from '../catalog';

// the calendar hub's selected-day card: date + cycle day + phase, fertility summary,
// logged-category chips, and the Edit period / Add note actions.
export const DayCard = ({
  day,
  selected,
  chance,
  logs,
  onEditPeriod,
  onAddNote,
}: {
  day: CycleDay | null;
  selected: string;
  chance: string | null;
  logs: { id: string; type: string; value: string }[];
  onEditPeriod: () => void;
  onAddNote: () => void;
}) => {
  const phase = day?.phase ? phaseMeta[day.phase] : null;
  const label = new Date(`${selected}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <Card style={styles.dayCard}>
      <View style={styles.dayHead}>
        <IconBox icon={Sparkles} size={34} tint={c.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.dayTitle}>{label}</Text>
          {day?.cycleDay ? (
            <Text style={styles.daySub}>Cycle day {day.cycleDay}</Text>
          ) : null}
        </View>
        {phase ? (
          <View style={[styles.phaseTag, { backgroundColor: phase.soft }]}>
            <Text style={[styles.phaseTagText, { color: phase.color }]}>
              {phase.label}
            </Text>
          </View>
        ) : null}
      </View>

      {chance ? (
        <Text style={styles.chance}>{chance} chance of getting pregnant</Text>
      ) : null}

      {logs.length > 0 ? (
        <View style={styles.logChips}>
          {logs.map((log) => (
            <View key={log.id} style={styles.logChip}>
              <Text style={styles.logChipText}>
                {CATALOG_BY_KEY[log.type]?.label ?? log.type}
                {log.value ? ` · ${log.value}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.dayActions}>
        <Pressable onPress={onEditPeriod} style={styles.actionGhost}>
          <Pencil color={c.accentText} size={16} strokeWidth={2.2} />
          <Text style={styles.actionGhostText}>Edit period</Text>
        </Pressable>
        <Pressable onPress={onAddNote} style={styles.actionSolid}>
          <CalendarPlus color={c.onAccent} size={16} strokeWidth={2.2} />
          <Text style={styles.actionSolidText}>Add note</Text>
        </Pressable>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  dayCard: { gap: 12 },
  dayHead: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  dayTitle: { color: c.ink, fontSize: 17, fontWeight: '700' },
  daySub: { color: c.muted, fontSize: 13, marginTop: 2 },
  phaseTag: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  phaseTagText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chance: { color: c.inkSoft, fontSize: 15, fontWeight: '600' },
  logChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  logChip: {
    backgroundColor: panel[4],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  logChipText: { color: c.inkSoft, fontSize: 12, fontWeight: '600' },
  dayActions: { flexDirection: 'row', gap: 10 },
  actionGhost: {
    alignItems: 'center',
    backgroundColor: c.accentSoft,
    borderRadius: 13,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  actionGhostText: { color: c.accentText, fontSize: 14, fontWeight: '700' },
  actionSolid: {
    alignItems: 'center',
    backgroundColor: c.accent,
    borderRadius: 13,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  actionSolidText: { color: c.onAccent, fontSize: 14, fontWeight: '700' },
});
