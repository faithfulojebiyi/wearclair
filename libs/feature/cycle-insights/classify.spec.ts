import { describe, expect, it } from 'bun:test';

import { generateSamples } from '@feature/biomarker-sim/generator';
import {
  cycleDayFor,
  phaseForCycleDay,
} from '@feature/biomarker-sim/cycle-model';
import { DailyStat, RawSample } from '@system/timeseries/biomarker.store';
import { BiomarkerMetric } from '@system/timeseries/timeseries.schema';

import { classifyCycleDays, readinessScore } from './classify';
import { CyclePhase } from './phase';

const USER_ID = 'test-user-1';
const DAY_MS = 24 * 60 * 60 * 1000;

// replicate the biomarker_1d rollup in memory: samples -> per-(day, metric) stats
const toDailyStats = (samples: RawSample[]): DailyStat[] => {
  const groups = new Map<
    string,
    { day: Date; metric: BiomarkerMetric; values: number[] }
  >();

  for (const sample of samples) {
    const dayIso = sample.ts.toISOString().slice(0, 10);
    const key = `${dayIso}:${sample.metric}`;
    const group = groups.get(key) ?? {
      day: new Date(`${dayIso}T00:00:00.000Z`),
      metric: sample.metric,
      values: [],
    };
    group.values.push(sample.value);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    day: group.day,
    metric: group.metric,
    avg:
      group.values.reduce((sum, value) => sum + value, 0) / group.values.length,
    min: Math.min(...group.values),
    max: Math.max(...group.values),
    count: group.values.length,
  }));
};

// fixed window so the test is fully reproducible
const FROM = new Date('2026-04-01T00:00:00.000Z');
const TO = new Date('2026-06-10T00:00:00.000Z');

const stats = toDailyStats(
  generateSamples({ userId: USER_ID, from: FROM, to: TO }),
);

describe('classifyCycleDays', () => {
  it('is deterministic', () => {
    const first = classifyCycleDays(stats);
    const second = classifyCycleDays(stats);

    expect(second).toEqual(first);
  });

  it('recovers the luteal temperature shift from rollups alone', () => {
    const insights = classifyCycleDays(stats);

    // skip the classifier's warm-up (needs 10 days of temp history for the
    // moving-average baseline)
    const evaluated = insights.filter(
      (insight) => insight.date.getTime() >= FROM.getTime() + 15 * DAY_MS,
    );

    const truth = (date: Date) => phaseForCycleDay(cycleDayFor(USER_ID, date));

    const trueLuteal = evaluated.filter((i) => truth(i.date) === 'luteal');
    const classifiedLuteal = evaluated.filter(
      (i) => i.phase === CyclePhase.LUTEAL,
    );
    const correctLuteal = classifiedLuteal.filter(
      (i) => truth(i.date) === 'luteal',
    );

    expect(trueLuteal.length).toBeGreaterThan(0);
    // recall: most genuinely-luteal days are detected
    expect(correctLuteal.length / trueLuteal.length).toBeGreaterThan(0.6);
    // precision: most detected-luteal days are genuinely luteal
    expect(correctLuteal.length / classifiedLuteal.length).toBeGreaterThan(0.6);
  });

  it('places menstrual days right after the luteal block ends', () => {
    const insights = classifyCycleDays(stats);

    for (let i = 1; i < insights.length; i += 1) {
      if (
        insights[i - 1].phase === CyclePhase.LUTEAL &&
        insights[i].phase !== CyclePhase.LUTEAL
      ) {
        expect(insights[i].phase).toBe(CyclePhase.MENSTRUAL);
        expect(insights[i].cycleDay).toBeLessThanOrEqual(3);
      }
    }
  });

  it('produces bounded readiness with plausible per-day fields', () => {
    const insights = classifyCycleDays(stats);

    for (const insight of insights) {
      expect(insight.readiness).toBeGreaterThanOrEqual(0);
      expect(insight.readiness).toBeLessThanOrEqual(100);
      expect(insight.basalTempC).toBeGreaterThan(35);
      expect(insight.basalTempC).toBeLessThan(38);
      expect(insight.restingHrBpm).toBeGreaterThan(40);
      expect(insight.hrvRmssdMs).toBeGreaterThan(20);
    }
  });
});

describe('readinessScore', () => {
  it('drops when HRV is suppressed and HR/temp elevated', () => {
    const rested = readinessScore({
      hrvDelta: 0.05,
      hrDelta: -0.02,
      tempDelta: -0.1,
    });
    const strained = readinessScore({
      hrvDelta: -0.15,
      hrDelta: 0.08,
      tempDelta: 0.4,
    });

    expect(rested).toBeGreaterThan(strained);
    expect(strained).toBeLessThan(80);
  });
});
