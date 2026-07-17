import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { c } from '../lib/theme';

// a ~260° arc gauge (gap at the bottom) with a gradient-stroked progress arc.
// angle convention: 0° = top (12 o'clock), increasing clockwise.
const SWEEP = 260;
const START = -SWEEP / 2;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;

  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
};

const arcPath = (
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) => {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
};

interface GaugeArcProps {
  value: number; // 0..100
  color: string;
  size?: number;
  stroke?: number;
  big: string;
  label?: string;
  sub?: string;
}

export const GaugeArc = ({
  value,
  color,
  size = 220,
  stroke = 14,
  big,
  label,
  sub,
}: GaugeArcProps) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const clamped = Math.max(0, Math.min(100, value));
  const valueEnd = START + (clamped / 100) * SWEEP;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="gauge" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.65} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>

        <Path
          d={arcPath(cx, cy, r, START, START + SWEEP)}
          stroke={c.surface3}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />

        {clamped > 0 ? (
          <Path
            d={arcPath(cx, cy, r, START, valueEnd)}
            stroke="url(#gauge)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </Svg>

      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.big, { color }]}>{big}</Text>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  big: {
    fontSize: 58,
    fontWeight: '800',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  label: {
    color: c.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  sub: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
});
