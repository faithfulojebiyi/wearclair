import { Pressable, StyleSheet, Text } from 'react-native';

import { c, panel } from '@/ui/theme/theme';

// a pill toggle used for the Perform metric + range selectors.
export const Chip = ({
  active,
  activeColor,
  label,
  onPress,
}: {
  active: boolean;
  activeColor: string;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.chip,
      active && { backgroundColor: activeColor, borderColor: activeColor },
    ]}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  chip: {
    backgroundColor: panel[4],
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  chipText: { color: c.inkSoft, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: c.onAccent },
});
