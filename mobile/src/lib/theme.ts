import { CyclePhase } from '../api/generated/wearclairAPI.schemas';

// "clinical warmth in the dark" — near-black canvas, layered graphite surfaces, a
// single warm accent (#ff6116, Radix red/orange-9), and biologically-coded phase
// hues. Derived from the provided Radix gray + red(orange) dark ramps.
export const c = {
  bg: '#0E0E10', // below gray-1, a touch deeper for OLED
  surface: '#161618', // gray-2-ish
  surface2: '#1D1E20', // gray-3
  surface3: '#242528',
  border: '#282A2E', // gray-4/5
  borderStrong: '#393A40', // gray-6
  text: '#EEEEF0', // gray-12
  textDim: '#B2B3BD', // gray-11
  textMuted: '#797B86', // gray-10
  textFaint: '#5F606A', // gray-8/9

  accent: '#FF6116', // red-9
  accentDeep: '#F15400', // red-10
  accentSoft: 'rgba(255, 97, 22, 0.13)',
  accentText: '#FF9B72', // red-11 (dark)

  good: '#46E5A6',
  goodSoft: 'rgba(70, 229, 166, 0.13)',
  warn: '#E6A23D',
} as const;

// readiness / score coloring: green (rested) → amber → warm accent (strained)
export const scoreColor = (value: number): string => {
  if (value >= 75) {
    return c.good;
  }

  if (value >= 55) {
    return c.warn;
  }

  return c.accent;
};

export const phaseMeta: Record<
  CyclePhase,
  { label: string; color: string; soft: string; blurb: string }
> = {
  MENSTRUAL: {
    label: 'Menstrual',
    color: '#F2708A',
    soft: 'rgba(242, 112, 138, 0.14)',
    blurb: 'Temperature has settled back to baseline — the start of a new cycle.',
  },
  FOLLICULAR: {
    label: 'Follicular',
    color: '#E6A23D',
    soft: 'rgba(230, 162, 61, 0.14)',
    blurb: 'Estrogen climbing: HRV trending up, resting heart rate and temp low.',
  },
  OVULATORY: {
    label: 'Ovulatory',
    color: '#46E5A6',
    soft: 'rgba(70, 229, 166, 0.14)',
    blurb: 'Near the temperature nadir — the luteal shift usually follows in days.',
  },
  LUTEAL: {
    label: 'Luteal',
    color: '#9B8AE6',
    soft: 'rgba(155, 138, 230, 0.14)',
    blurb: 'Progesterone signature: +0.3–0.5 °C, resting HR up, HRV dipping.',
  },
};

export const metricMeta = {
  skin_temp: { label: 'Skin temp', unit: '°C', decimals: 2, tint: '#F2708A' },
  heart_rate: { label: 'Heart rate', unit: 'bpm', decimals: 0, tint: '#FF6116' },
  hrv: { label: 'HRV', unit: 'ms', decimals: 0, tint: '#46E5A6' },
  respiratory_rate: { label: 'Resp. rate', unit: 'br/min', decimals: 1, tint: '#5AA9E6' },
  eda: { label: 'EDA', unit: 'µS', decimals: 2, tint: '#E6A23D' },
  arterial_stiffness: { label: 'Art. stiffness', unit: 'm/s', decimals: 1, tint: '#C58AE6' },
  perfusion_index: { label: 'Perfusion', unit: '%', decimals: 1, tint: '#E68AB8' },
  spo2: { label: 'SpO₂', unit: '%', decimals: 0, tint: '#5AA9E6' },
  bioimpedance: { label: 'Bioimpedance', unit: 'Ω', decimals: 0, tint: '#9B8AE6' },
  motion_index: { label: 'Motion', unit: 'mg', decimals: 0, tint: '#8FCf7F' },
} as const;

export const space = {
  screen: 20,
  gap: 12,
  card: 18,
} as const;
