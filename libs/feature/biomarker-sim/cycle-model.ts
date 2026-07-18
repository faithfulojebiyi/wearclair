// the simulated physiology: a 28-day hormonal cycle expressed through the wearable
// metrics. Deliberately simple but directionally faithful — the luteal progesterone
// rise shows up as +0.4 °C skin temp, +4 bpm resting HR, −12% HRV; ovulation is
// preceded by a small temperature nadir. These are the signatures the classifier in
// @feature/cycle-insights is built to recover from the rollups.

import { BiomarkerMetric } from '@system/timeseries/timeseries.schema';

import { hashSeed } from './prng';

export const CYCLE_LENGTH_DAYS = 28;

// fixed epoch so cycle position is a pure function of (userId, date)
const CYCLE_EPOCH_UTC_MS = Date.UTC(2024, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

// demo cycle anchoring: day 1 (period start) is pinned to the most recent 18th at or
// before the reference date, so the cycle always begins mid-month. Both the seed and
// the live simulate-sync pass this anchor, so the whole history + new syncs stay one
// continuous 28-day cycle. (Without an anchor, cycleDayFor falls back to the per-user
// hash offset.)
export const CYCLE_ANCHOR_DAY_OF_MONTH = 18;

export const cycleAnchorFor = (now: Date): number => {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  return now.getUTCDate() >= CYCLE_ANCHOR_DAY_OF_MONTH
    ? Date.UTC(y, m, CYCLE_ANCHOR_DAY_OF_MONTH)
    : Date.UTC(y, m - 1, CYCLE_ANCHOR_DAY_OF_MONTH);
};

export type SimCyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

// cycle day (1-based) for a date. With `anchorMs`, day 1 is the anchor date and the
// cycle counts continuously from there; otherwise it falls back to a stable per-user
// offset so "today" lands on a consistent cycle day across runs.
export const cycleDayFor = (
  userId: string,
  date: Date,
  anchorMs?: number,
): number => {
  if (anchorMs !== undefined) {
    const days = Math.floor((date.getTime() - anchorMs) / DAY_MS);

    return (
      (((days % CYCLE_LENGTH_DAYS) + CYCLE_LENGTH_DAYS) % CYCLE_LENGTH_DAYS) + 1
    );
  }

  const offsetDays = hashSeed(`${userId}:cycle-anchor`) % CYCLE_LENGTH_DAYS;
  const daysSinceEpoch = Math.floor(
    (date.getTime() - CYCLE_EPOCH_UTC_MS) / DAY_MS,
  );

  return (
    ((((daysSinceEpoch + offsetDays) % CYCLE_LENGTH_DAYS) + CYCLE_LENGTH_DAYS) %
      CYCLE_LENGTH_DAYS) +
    1
  );
};

export const phaseForCycleDay = (cycleDay: number): SimCyclePhase => {
  if (cycleDay <= 5) {
    return 'menstrual';
  }

  if (cycleDay <= 13) {
    return 'follicular';
  }

  if (cycleDay <= 15) {
    return 'ovulatory';
  }

  return 'luteal';
};

interface MetricCurve {
  baseline: number;
  // added during the luteal phase (progesterone effect)
  lutealShift: number;
  // peak-to-baseline amplitude of the daytime circadian swing
  circadianAmplitude: number;
  // gaussian noise sigma per sample
  noiseSigma: number;
}

export const METRIC_CURVES: Record<BiomarkerMetric, MetricCurve> = {
  skin_temp: {
    baseline: 36.4,
    lutealShift: 0.4,
    circadianAmplitude: 0.25,
    noiseSigma: 0.06,
  },
  heart_rate: {
    baseline: 62,
    lutealShift: 4,
    circadianAmplitude: 8,
    noiseSigma: 2.2,
  },
  hrv: {
    baseline: 65,
    lutealShift: -7.8,
    circadianAmplitude: -10,
    noiseSigma: 4.5,
  },
  respiratory_rate: {
    baseline: 14,
    lutealShift: 0.5,
    circadianAmplitude: 1.2,
    noiseSigma: 0.4,
  },
  eda: {
    baseline: 0.3,
    lutealShift: 0,
    circadianAmplitude: 0.35,
    noiseSigma: 0.05,
  },
  // cardiovascular: pulse-wave-velocity proxy (m/s). Estrogen raises arterial
  // compliance in the follicular phase, so stiffness rises in the luteal phase.
  arterial_stiffness: {
    baseline: 7,
    lutealShift: 0.4,
    circadianAmplitude: 0.3,
    noiseSigma: 0.15,
  },
  // cardiovascular: PPG perfusion index (%). Mostly a peripheral-blood-flow /
  // circadian signal — no strong documented cycle effect (honest context metric).
  perfusion_index: {
    baseline: 1.4,
    lutealShift: 0,
    circadianAmplitude: 0.5,
    noiseSigma: 0.12,
  },
  // cardiovascular: blood oxygen (%). Flat, dips slightly in sleep — carried as a
  // context channel, no cycle signature.
  spo2: {
    baseline: 97.5,
    lutealShift: 0,
    circadianAmplitude: 0.4,
    noiseSigma: 0.35,
  },
  // bioimpedance (Ω): progesterone drives luteal fluid retention -> more body water
  // -> lower impedance. A genuine cycle signal in the opposite direction to temp.
  bioimpedance: {
    baseline: 500,
    lutealShift: -15,
    circadianAmplitude: -8,
    noiseSigma: 4,
  },
  // activity/motion (mg): strong day/night circadian, no cycle effect (context).
  motion_index: {
    baseline: 30,
    lutealShift: 0,
    circadianAmplitude: 75,
    noiseSigma: 8,
  },
};

// deterministic expected value for a metric at a cycle day + hour of day (no noise)
export const metricMean = (
  metric: BiomarkerMetric,
  cycleDay: number,
  hourOfDay: number,
): number => {
  const curve = METRIC_CURVES[metric];
  const phase = phaseForCycleDay(cycleDay);

  let value = curve.baseline;

  // daytime circadian swing peaking mid-afternoon (negative amplitude = daytime dip,
  // which is what HRV does)
  const circadian = Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI) * 0.5 + 0.5;
  value += curve.circadianAmplitude * circadian;

  if (phase === 'luteal') {
    value += curve.lutealShift;
  }

  // pre-ovulatory temperature nadir on day 13
  if (metric === 'skin_temp' && cycleDay === 13) {
    value -= 0.15;
  }

  return value;
};
