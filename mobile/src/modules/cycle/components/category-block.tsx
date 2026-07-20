import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { IconBox } from '@/ui/primitives/ui';
import { c, panel } from '@/ui/theme/theme';

import { Category, joinValue, splitValue } from '../catalog';

// one Track category: chips for multi/single, a textarea for diary, an add-item list
// for medicine/tags. `value` is the raw comma-joined (or free-text) stored value.
export const CategoryBlock = ({
  category,
  value,
  onChange,
}: {
  category: Category;
  value: string;
  onChange: (value: string) => void;
}) => {
  const selected = splitValue(value);

  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <IconBox icon={category.icon} size={32} tint={category.tint} />
        <Text style={styles.blockTitle}>{category.label}</Text>
      </View>

      {category.kind === 'diary' ? (
        <DiaryInput onChange={onChange} value={value} />
      ) : category.kind === 'list' ? (
        <ListInput onChange={onChange} selected={selected} />
      ) : (
        <View style={styles.chips}>
          {(category.options ?? []).map((option) => {
            const on = selected.includes(option);

            const toggle = () => {
              if (category.kind === 'single') {
                onChange(on ? '' : option);

                return;
              }

              onChange(
                joinValue(
                  on
                    ? selected.filter((s) => s !== option)
                    : [...selected, option],
                ),
              );
            };

            return (
              <Pressable
                key={option}
                onPress={toggle}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
};

const DiaryInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);

  return (
    <TextInput
      multiline
      onBlur={() => {
        if (draft !== value) {
          onChange(draft);
        }
      }}
      onChangeText={setDraft}
      placeholder="Write a note…"
      placeholderTextColor={c.faint}
      style={styles.diary}
      value={draft}
    />
  );
};

const ListInput = ({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (value: string) => void;
}) => {
  const [draft, setDraft] = useState('');

  const add = () => {
    const item = draft.trim();

    if (item.length === 0 || selected.includes(item)) {
      setDraft('');

      return;
    }

    onChange(joinValue([...selected, item]));
    setDraft('');
  };

  return (
    <View style={{ gap: 8 }}>
      {selected.length > 0 ? (
        <View style={styles.chips}>
          {selected.map((item) => (
            <Pressable
              key={item}
              onPress={() =>
                onChange(joinValue(selected.filter((s) => s !== item)))
              }
              style={[styles.chip, styles.chipOn]}
            >
              <Text style={[styles.chipText, styles.chipTextOn]}>{item} ✕</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.addRow}>
        <TextInput
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="Add…"
          placeholderTextColor={c.faint}
          returnKeyType="done"
          style={styles.addInput}
          value={draft}
        />
        <Pressable onPress={add} style={styles.addBtn}>
          <Plus color={c.onAccent} size={18} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    backgroundColor: c.card,
    borderRadius: 20,
    gap: 12,
    padding: 16,
    shadowColor: '#8a6a4a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  blockHead: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  blockTitle: { color: c.ink, fontSize: 16, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: panel[4],
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipOn: { backgroundColor: c.accent },
  chipText: { color: c.inkSoft, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: c.onAccent },
  diary: {
    backgroundColor: panel[4],
    borderRadius: 13,
    color: c.ink,
    fontSize: 15,
    minHeight: 72,
    padding: 12,
    textAlignVertical: 'top',
  },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: {
    backgroundColor: panel[4],
    borderRadius: 13,
    color: c.ink,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addBtn: {
    alignItems: 'center',
    backgroundColor: c.accent,
    borderRadius: 13,
    justifyContent: 'center',
    width: 46,
  },
});
