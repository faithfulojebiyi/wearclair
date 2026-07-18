import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, Eye, EyeOff, X } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  moveCategory,
  toggleHidden,
  useHiddenSet,
  useOrderedCategories,
} from '@/modules/cycle/prefs';
import { IconBox } from '@/ui/primitives/ui';
import { c, panel, serifBold, space } from '@/ui/theme/theme';

export default function ParametersScreen() {
  const router = useRouter();
  const categories = useOrderedCategories();
  const hidden = useHiddenSet();

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.iconBtn}>
          <X color={c.ink} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title}>Parameters</Text>
        <View style={styles.iconBtn} />
      </View>

      <Text style={styles.hint}>
        Show, hide, and reorder what you can track.
      </Text>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {categories.map((cat, index) => {
          const isHidden = hidden.has(cat.key);

          return (
            <View key={cat.key} style={[styles.row, isHidden && styles.rowHidden]}>
              <IconBox icon={cat.icon} size={34} tint={cat.tint} />
              <Text style={styles.label}>{cat.label}</Text>

              <View style={styles.actions}>
                <Pressable
                  disabled={index === 0}
                  hitSlop={8}
                  onPress={() => moveCategory(cat.key, -1)}
                  style={[styles.arrow, index === 0 && styles.arrowDisabled]}
                >
                  <ChevronUp color={c.inkSoft} size={20} strokeWidth={2.2} />
                </Pressable>
                <Pressable
                  disabled={index === categories.length - 1}
                  hitSlop={8}
                  onPress={() => moveCategory(cat.key, 1)}
                  style={[
                    styles.arrow,
                    index === categories.length - 1 && styles.arrowDisabled,
                  ]}
                >
                  <ChevronDown color={c.inkSoft} size={20} strokeWidth={2.2} />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => toggleHidden(cat.key)}
                  style={styles.eye}
                >
                  {isHidden ? (
                    <EyeOff color={c.muted} size={20} strokeWidth={2.2} />
                  ) : (
                    <Eye color={c.accent} size={20} strokeWidth={2.2} />
                  )}
                </Pressable>
              </View>
            </View>
          );
        })}
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
  hint: {
    color: c.muted,
    fontSize: 14,
    paddingBottom: 8,
    paddingHorizontal: space.screen,
  },
  container: {
    gap: 8,
    paddingBottom: 40,
    paddingHorizontal: space.screen,
    paddingTop: 4,
  },
  row: {
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    shadowColor: '#8a6a4a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  rowHidden: { opacity: 0.55 },
  label: { color: c.ink, flex: 1, fontSize: 15, fontWeight: '600' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  arrow: {
    alignItems: 'center',
    backgroundColor: panel[4],
    borderRadius: 9,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  arrowDisabled: { opacity: 0.35 },
  eye: {
    alignItems: 'center',
    backgroundColor: panel[4],
    borderRadius: 9,
    height: 32,
    justifyContent: 'center',
    marginLeft: 4,
    width: 32,
  },
});
