import { Droplet, Leaf, LucideIcon, Smile } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, IconBox } from '@/ui/primitives/ui';
import { c } from '@/ui/theme/theme';

import { useCreateLog } from '../mutations/use-create-log';

const QUICK_ACTIONS: {
  type: string;
  value: string;
  label: string;
  icon: LucideIcon;
  tint: string;
}[] = [
  { type: 'period', value: 'started', label: 'Period', icon: Droplet, tint: '#B85C6E' },
  { type: 'symptom', value: 'cramps', label: 'Symptoms', icon: Leaf, tint: '#4E9B6F' },
  { type: 'mood', value: 'good', label: 'Mood', icon: Smile, tint: '#C98B2D' },
];

// one-tap logging shortcuts on the home screen.
export const QuickActions = () => {
  const logAction = useCreateLog();

  return (
    <>
      <View style={styles.actions}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.type}
            onPress={() =>
              logAction.mutate({ type: action.type, value: action.value })
            }
            style={({ pressed }) => [styles.actionWrap, pressed && styles.pressed]}
          >
            <Card style={styles.action}>
              <IconBox icon={action.icon} tint={action.tint} />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
      {logAction.isSuccess ? <Text style={styles.logged}>Logged ✓</Text> : null}
    </>
  );
};

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 12 },
  actionWrap: { flex: 1 },
  pressed: { opacity: 0.7 },
  action: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  actionLabel: { color: c.inkSoft, fontSize: 13, fontWeight: '600' },
  logged: { color: c.good, fontSize: 13, textAlign: 'center' },
});
