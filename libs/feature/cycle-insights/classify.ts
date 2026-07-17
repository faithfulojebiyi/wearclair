// cycle-phase classification + readiness from daily rollups. Pure and deterministic
// so the whole derivation pipeline is unit-testable without a database. Deliberately
// independent of @feature/biomarker-sim — the simulator plays "physiology", this lib
// has to recover the signal from the rollups alone (the same inputs a real device
// stream would produce).

import { CyclePhase } from '@orm/app';

import { DailyStat } from '@system/timeseries/biomarker.store';

export interface PerDayInsight {
  date: Date;
  cycleDay: number;
  phase: CyclePhase;
  basalTempC: number;
  restingHrBpm: number;
  hrvRmssdMs: number;
  readiness: number;
}

interface DayMetrics {
  date: Date;
  temp?: number;
  hr?: number;
  hrv?: number;
}

// sustained-shift detection: 3-day moving average of temperature at least +0.2 °C
// over the mean of the preceding 7 days marks the luteal (post-ovulatory) block —
// the classic BBT two-phase rule, applied to wrist skin temp.
const TEMP_SHIFT_C = 0.2;
const SHORT_WINDOW = 3;
const BASELINE_WINDOW = 7;
const MENSTRUAL_DAYS = 5;
const OVULATORY_DAYS = 2;

export const DAY_MS = 24 * 60 * 60 * 1000;

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const toDayMetrics = (stats: DailyStat[]): DayMetrics[] => {
  const byDay = new Map<number, DayMetrics>();

  for (const stat of stats) {
    const key = stat.day.getTime();
    const entry = byDay.get(key) ?? { date: stat.day };

    if (stat.metric === 'skin_temp') {
      // nightly basal proxy: daily minimum tracks the sleeping baseline better than
      // the daytime-skewed average
      entry.temp = stat.min;
    }

    if (stat.metric === 'heart_rate') {
      entry.hr = stat.min;
    }

    if (stat.metric === 'hrv') {
      entry.hrv = stat.max;
    }

    byDay.set(key, entry);
  }

  return [...byDay.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
};

// two-state latch over the temperature series: trigger when the 3-day moving
// average rises >= +0.2 °C over the mean of the preceding 7 days, then stay
// elevated (against the FROZEN pre-shift baseline — a rolling one would chase the
// elevation and drop out mid-luteal) until temperature falls back within half the
// shift of that baseline.
const computeElevated = (days: DayMetrics[]): boolean[] => {
  const temps = days.map((day) => day.temp);
  const elevated = days.map(() => false);

  let frozenBaseline: number | undefined;

  for (let index = 0; index < days.length; index += 1) {
    const shortStart = index - SHORT_WINDOW + 1;
    const shortWindow = temps.slice(Math.max(0, shortStart), index + 1);

    if (shortWindow.some((temp) => temp === undefined)) {
      frozenBaseline = undefined;
      continue;
    }

    const recent = mean(shortWindow as number[]);

    if (frozenBaseline === undefined) {
      const baselineStart = shortStart - BASELINE_WINDOW;

      if (baselineStart < 0) {
        continue;
      }

      const baselineWindow = temps.slice(baselineStart, shortStart);

      if (baselineWindow.some((temp) => temp === undefined)) {
        continue;
      }

      const baseline = mean(baselineWindow as number[]);

      if (recent - baseline >= TEMP_SHIFT_C) {
        frozenBaseline = baseline;
        elevated[index] = true;
      }
    } else if (recent - frozenBaseline >= TEMP_SHIFT_C / 2) {
      elevated[index] = true;
    } else {
      frozenBaseline = undefined;
    }
  }

  return elevated;
};

export const classifyCycleDays = (stats: DailyStat[]): PerDayInsight[] => {
  const days = toDayMetrics(stats);

  if (days.length === 0) {
    return [];
  }

  const elevated = computeElevated(days);

  // menses onset = the temperature drop after a sustained luteal elevation
  const onsets: number[] = [];

  for (let i = 1; i < days.length; i += 1) {
    if (elevated[i - 1] && !elevated[i]) {
      onsets.push(i);
    }
  }

  // baselines for readiness: rolling mean over up to the previous 14 days
  const readinessBaseline = (
    index: number,
    pick: (day: DayMetrics) => number | undefined,
  ): number | undefined => {
    const window = days
      .slice(Math.max(0, index - 14), index)
      .map(pick)
      .filter((value): value is number => value !== undefined);

    return window.length >= 3 ? mean(window) : undefined;
  };

  return days.map((day, index) => {
    // cycle day: distance from the most recent onset at or before this day; before
    // the first detected onset, count backward from it
    let cycleDay: number;
    const lastOnset = [...onsets].reverse().find((onset) => onset <= index);

    if (lastOnset !== undefined) {
      cycleDay = index - lastOnset + 1;
    } else if (onsets.length > 0) {
      cycleDay = ((((index - onsets[0]) % 28) + 28) % 28) + 1;
    } else {
      cycleDay = (index % 28) + 1;
    }

    let phase: CyclePhase;

    if (elevated[index]) {
      phase = CyclePhase.LUTEAL;
    } else if (cycleDay <= MENSTRUAL_DAYS) {
      phase = CyclePhase.MENSTRUAL;
    } else if (
      index + OVULATORY_DAYS < days.length &&
      elevated.slice(index + 1, index + 1 + OVULATORY_DAYS + 1).some(Boolean)
    ) {
      // the days immediately before a detected shift are the ovulatory window
      phase = CyclePhase.OVULATORY;
    } else {
      phase = CyclePhase.FOLLICULAR;
    }

    const temp = day.temp ?? 0;
    const hr = day.hr ?? 0;
    const hrv = day.hrv ?? 0;

    const tempBaseline = readinessBaseline(index, (d) => d.temp);
    const hrBaseline = readinessBaseline(index, (d) => d.hr);
    const hrvBaseline = readinessBaseline(index, (d) => d.hrv);

    const readiness = readinessScore({
      hrvDelta:
        hrvBaseline !== undefined && hrvBaseline > 0
          ? (hrv - hrvBaseline) / hrvBaseline
          : 0,
      hrDelta:
        hrBaseline !== undefined && hrBaseline > 0
          ? (hr - hrBaseline) / hrBaseline
          : 0,
      tempDelta: tempBaseline !== undefined ? temp - tempBaseline : 0,
    });

    return {
      date: day.date,
      cycleDay,
      phase,
      basalTempC: Number(temp.toFixed(2)),
      restingHrBpm: Number(hr.toFixed(1)),
      hrvRmssdMs: Number(hrv.toFixed(1)),
      readiness,
    };
  });
};

// 0-100 composite vs the user's rolling baseline: suppressed HRV, elevated resting
// HR and elevated temperature all pull readiness down.
export const readinessScore = (deltas: {
  hrvDelta: number; // relative, e.g. -0.12 = 12% below baseline
  hrDelta: number; // relative
  tempDelta: number; // absolute °C
}): number => {
  let score = 85;

  score += Math.min(deltas.hrvDelta, 0.3) * 100; // HRV up -> better, down -> worse
  score -= Math.max(deltas.hrDelta, -0.3) * 150; // HR up -> worse
  score -= Math.max(deltas.tempDelta, -0.5) * 30; // temp up -> worse

  return Math.max(0, Math.min(100, Math.round(score)));
};
