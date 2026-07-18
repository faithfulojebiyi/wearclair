import { BiomarkerMetric } from '@/api/generated/wearclairAPI.schemas';

// on-device BLE-band emulation: generates the current instant's vitals the way the
// real band would stream them to the phone. Self-contained port of the backend's
// cycle model (mobile can't import @feature/*), anchored per-user by the same fnv1a
// hash so "now" stays continuous with the seeded server history.

const hashSeed = (input: string): number => {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const gaussian = (next: () => number): number => {
  const u = Math.max(next(), Number.EPSILON);
  const v = next();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const CYCLE_LENGTH = 28;
const CYCLE_EPOCH_MS = Date.UTC(2024, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

const cycleDay = (userId: string, date: Date): number => {
  const offset = hashSeed(`${userId}:cycle-anchor`) % CYCLE_LENGTH;
  const days = Math.floor((date.getTime() - CYCLE_EPOCH_MS) / DAY_MS);

  return (((days + offset) % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH + 1;
};

const isLuteal = (day: number): boolean => day >= 16;

interface Curve {
  baseline: number;
  lutealShift: number;
  circadianAmplitude: number;
  noiseSigma: number;
}

const CURVES: Record<BiomarkerMetric, Curve> = {
  skin_temp: { baseline: 36.4, lutealShift: 0.4, circadianAmplitude: 0.25, noiseSigma: 0.06 },
  heart_rate: { baseline: 62, lutealShift: 4, circadianAmplitude: 8, noiseSigma: 2.2 },
  hrv: { baseline: 65, lutealShift: -7.8, circadianAmplitude: -10, noiseSigma: 4.5 },
  respiratory_rate: { baseline: 14, lutealShift: 0.5, circadianAmplitude: 1.2, noiseSigma: 0.4 },
  eda: { baseline: 0.3, lutealShift: 0, circadianAmplitude: 0.35, noiseSigma: 0.05 },
  arterial_stiffness: { baseline: 7, lutealShift: 0.4, circadianAmplitude: 0.3, noiseSigma: 0.15 },
  perfusion_index: { baseline: 1.4, lutealShift: 0, circadianAmplitude: 0.5, noiseSigma: 0.12 },
  spo2: { baseline: 97.5, lutealShift: 0, circadianAmplitude: 0.4, noiseSigma: 0.35 },
  bioimpedance: { baseline: 500, lutealShift: -15, circadianAmplitude: -8, noiseSigma: 4 },
  motion_index: { baseline: 30, lutealShift: 0, circadianAmplitude: 75, noiseSigma: 8 },
};

export const BAND_METRICS = Object.keys(CURVES) as BiomarkerMetric[];

export interface Vital {
  metric: BiomarkerMetric;
  value: number;
}

// the reading each sensor would report at `date` for `userId`.
export const sampleVitals = (userId: string, date: Date): Vital[] => {
  const day = cycleDay(userId, date);
  const luteal = isLuteal(day);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const circadian = Math.sin(((hour - 6) / 24) * 2 * Math.PI) * 0.5 + 0.5;

  return BAND_METRICS.map((metric) => {
    const curve = CURVES[metric];
    const noise = gaussian(mulberry32(hashSeed(`${userId}:${date.getTime()}:${metric}`)));

    let value = curve.baseline + curve.circadianAmplitude * circadian;

    if (luteal) {
      value += curve.lutealShift;
    }

    if (metric === 'skin_temp' && day === 13) {
      value -= 0.15;
    }

    value += noise * curve.noiseSigma;

    return { metric, value: Number(value.toFixed(4)) };
  });
};
