import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { c, space } from '../lib/theme';

// shared surface card — the graphite panel everything sits on.
export const Card = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) => <View style={[styles.card, style]}>{children}</View>;

// small section heading above a group of cards.
export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <Text style={styles.section}>{children}</Text>
);

// a colored pill (phase badge, status).
export const Pill = ({
  label,
  color,
  soft,
}: {
  label: string;
  color: string;
  soft: string;
}) => (
  <View style={[styles.pill, { backgroundColor: soft }]}>
    <View style={[styles.pillDot, { backgroundColor: color }]} />
    <Text style={[styles.pillText, { color }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.card,
  },
  section: {
    color: c.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 6,
  },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillDot: { borderRadius: 4, height: 7, width: 7 },
  pillText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
});
