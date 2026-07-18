import { CyclePhase } from '@/api/generated/wearclairAPI.schemas';

// the Clair palette — a Radix composition (radix-ui.com/colors, understanding-the-
// scale): a custom orange scale generated from the brand color #EE7A36 (= step 9)
// carries brand + solids, the gray scale carries neutral text, the translucent
// panel scale below carries insets. Each token is annotated with its Radix step
// so usage follows the scale's semantics:
//   1 app bg · 2 subtle bg · 3-5 component bg · 9 solid · 10 solid hover ·
//   11 low-contrast text · 12 high-contrast text.
export const c = {
  bg: '#FEFCFB', // orange-1  (app background)
  card: '#FFFFFF',
  cardWarm: '#FFF6F2', // orange-2  (subtle background)
  border: '#FFECE1', // orange-3  (component background — tint, not stroke)
  borderStrong: '#FFD9C2', // orange-4

  ink: '#54301D', // orange-12  (high-contrast text)
  inkSoft: '#62636C', // gray-11  (low-contrast text)
  muted: '#8B8D98', // gray-9
  faint: '#B9BBC6', // gray-8

  accent: '#EE7A36', // orange-9  (solid background — the Clair brand orange)
  accentDeep: '#E26D24', // orange-10  (solid hover/pressed)
  accentText: '#C55700', // orange-11  (accent-colored text)
  accentSoft: '#FFECE1', // orange-3  (accent component background)
  onAccent: '#FFFFFF', // orange-contrast

  good: '#46A758',
  goodSoft: '#E9F6EB',
  warn: '#E2A336',
} as const;

// translucent neutral panel scale (base #0a1217 at alpha steps) — layered tint
// separation for inset panels, icon chips, tracks and dividers instead of borders
// or heavy shadows. Mixes with any surface underneath (white card, cream bg).
export const panel = {
  1: '#0a121703',
  2: '#0a121705',
  3: '#0a121708',
  4: '#0a12170a',
  5: '#0a12170d',
  6: '#0a12170f',
  7: '#0a121712',
  8: '#0a121714',
  10: '#0a12171a',
  15: '#0a121726',
  20: '#0a121733',
  muted: '#0a121766',
  mutedSolid: '#666e74',
} as const;

// editorial serif for headlines (loaded in the root layout); system for body.
export const serif = 'Fraunces_600SemiBold';
export const serifBold = 'Fraunces_700Bold';

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
    color: '#B85C6E',
    soft: '#F6E3E7',
    blurb: 'Temperature has settled back to baseline — the start of a new cycle.',
  },
  FOLLICULAR: {
    label: 'Follicular',
    color: '#4E9B6F',
    soft: '#E3F0E7',
    blurb: 'Estrogen climbing: HRV trending up, resting heart rate and temp low.',
  },
  OVULATORY: {
    label: 'Ovulatory',
    color: '#C98B2D',
    soft: '#F7ECD8',
    blurb: 'Near the temperature nadir — the luteal shift usually follows in days.',
  },
  LUTEAL: {
    label: 'Luteal',
    color: '#8A6FB8',
    soft: '#ECE6F5',
    blurb: 'Progesterone signature: +0.3–0.5 °C, resting HR up, HRV dipping.',
  },
};

// hormone display meta — colors follow the reference (estrogen violet, progesterone
// rose, LH amber, FSH blue). max = top of the display bar, not a clinical limit.
export const hormoneMeta = {
  estradiolPgMl: { label: 'Estrogen', unit: 'pg/mL', color: '#8B6FC9', max: 320, decimals: 0 },
  progesteroneNgMl: { label: 'Progesterone', unit: 'ng/mL', color: '#C96F8A', max: 16, decimals: 1 },
  lhMiuMl: { label: 'LH', unit: 'mIU/mL', color: '#C9A23D', max: 60, decimals: 1 },
  fshMiuMl: { label: 'FSH', unit: 'mIU/mL', color: '#5B8FC9', max: 14, decimals: 1 },
} as const;

export type HormoneKey = keyof typeof hormoneMeta;

export const metricMeta = {
  skin_temp: { label: 'Skin temp', unit: '°C', decimals: 2, tint: '#B85C6E' },
  heart_rate: { label: 'Heart rate', unit: 'bpm', decimals: 0, tint: '#B4622D' },
  hrv: { label: 'HRV', unit: 'ms', decimals: 0, tint: '#4E9B6F' },
  respiratory_rate: { label: 'Resp. rate', unit: 'br/min', decimals: 1, tint: '#5B8FC9' },
  eda: { label: 'EDA', unit: 'µS', decimals: 2, tint: '#C98B2D' },
  arterial_stiffness: { label: 'Art. stiffness', unit: 'm/s', decimals: 1, tint: '#8A6FB8' },
  perfusion_index: { label: 'Perfusion', unit: '%', decimals: 1, tint: '#C96F8A' },
  spo2: { label: 'SpO₂', unit: '%', decimals: 0, tint: '#5B8FC9' },
  bioimpedance: { label: 'Bioimpedance', unit: 'Ω', decimals: 0, tint: '#8B6FC9' },
  motion_index: { label: 'Motion', unit: 'mg', decimals: 0, tint: '#4E9B6F' },
} as const;

export const space = {
  screen: 20,
  gap: 12,
  card: 18,
} as const;
