import { LucideIcon } from 'lucide-react-native';
import { ReactNode } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { c, panel, serif, space } from '@/ui/theme/theme';

// ── card-in-card design system ────────────────────────────────────────────────
// Borderless, tint-layered: outer Card is soft white on the cream canvas; the
// InnerCard inset reads through a translucent panel tint (no borders, no heavy
// shadows). IconBox is the small squircle chip on a panel tint. Headers and footer
// meta live in the outer card's padding; content lives in the inner panel.

export const Card = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) => <View style={[styles.card, style]}>{children}</View>;

export const InnerCard = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) => <View style={[styles.inner, style]}>{children}</View>;

export const IconBox = ({
  icon: Icon,
  tint = c.ink,
  size = 34,
}: {
  icon: LucideIcon;
  tint?: string;
  size?: number;
}) => (
  <View style={[styles.iconBox, { height: size, width: size }]}>
    <Icon color={tint} size={size * 0.5} strokeWidth={2.2} />
  </View>
);

// header row for an outer card: icon chip + title (+ optional right slot)
export const CardHeader = ({
  icon,
  tint,
  title,
  right,
}: {
  icon?: LucideIcon;
  tint?: string;
  title: string;
  right?: ReactNode;
}) => (
  <View style={styles.cardHeader}>
    {icon ? <IconBox icon={icon} tint={tint} /> : null}
    <Text style={styles.cardTitle}>{title}</Text>
    {right ? <View style={styles.cardHeaderRight}>{right}</View> : null}
  </View>
);

export const StatCard = ({
  icon,
  tint = c.ink,
  label,
  value,
  unit,
  footer,
  style,
}: {
  icon: LucideIcon;
  tint?: string;
  label: string;
  value: string;
  unit?: string;
  footer?: string;
  style?: StyleProp<ViewStyle>;
}) => (
  <Card style={[styles.statCard, style]}>
    <View style={styles.statHead}>
      <IconBox icon={icon} size={30} tint={tint} />
      <Text numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
    </View>
    <InnerCard style={styles.statInner}>
      <Text style={styles.statValue}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
    </InnerCard>
    {footer ? <Text style={styles.statFooter}>{footer}</Text> : null}
  </Card>
);

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <Text style={styles.section}>{children}</Text>
);

// D / W / M / Y scope switcher — panel track, accent pill on the active segment.
export const Segmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) => (
  <View style={styles.segTrack}>
    {options.map((option) => {
      const active = option.key === value;

      return (
        <Pressable
          key={option.key}
          onPress={() => onChange(option.key)}
          style={[styles.segItem, active && styles.segItemActive]}
        >
          <Text style={[styles.segText, active && styles.segTextActive]}>
            {option.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

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
    backgroundColor: c.card,
    borderRadius: 24,
    padding: 14,
    shadowColor: '#8a6a4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  inner: {
    backgroundColor: panel[4],
    borderRadius: 16,
    padding: space.card - 4,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: panel[5],
    borderRadius: 10,
    justifyContent: 'center',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  cardTitle: { color: c.ink, fontFamily: serif, fontSize: 17 },
  cardHeaderRight: { marginLeft: 'auto' },
  statCard: { flexBasis: '47%', flexGrow: 1, gap: 10 },
  statHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
  },
  statLabel: { color: c.inkSoft, flex: 1, fontSize: 13, fontWeight: '600' },
  statInner: { paddingVertical: 12 },
  statValue: {
    color: c.ink,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  statUnit: { color: c.muted, fontSize: 13, fontWeight: '500' },
  statFooter: { color: c.muted, fontSize: 12, paddingHorizontal: 4 },
  section: {
    color: c.ink,
    fontFamily: serif,
    fontSize: 19,
    marginBottom: 10,
    marginTop: 8,
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
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  segTrack: {
    backgroundColor: panel[4],
    borderRadius: 12,
    flexDirection: 'row',
    padding: 3,
  },
  segItem: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    paddingVertical: 7,
  },
  segItemActive: { backgroundColor: c.accent },
  segText: { color: c.muted, fontSize: 13, fontWeight: '700' },
  segTextActive: { color: c.onAccent },
});
