// synthetic device stream: cycle-shaped biomarker samples on a fixed 5-minute grid.
// Pure + pointwise deterministic: value = f(userId, timestamp, metric) — any window,
// generated from any starting point, reproduces identical rows for overlapping
// timestamps, so the tsdb dedupe index turns re-ingest into a no-op. Used by the
// api's simulate-sync path and the seed script.

import { RawSample } from '@system/timeseries/biomarker.store';
import {
  BiomarkerMetric,
  biomarkerMetricSchema,
} from '@system/timeseries/timeseries.schema';

import { METRIC_CURVES, cycleDayFor, metricMean } from './cycle-model';
import { gaussian, hashSeed, mulberry32 } from './prng';

export const SAMPLE_INTERVAL_MINUTES = 5;

const INTERVAL_MS = SAMPLE_INTERVAL_MINUTES * 60 * 1000;

export interface GenerateSamplesArgs {
  userId: string;
  from: Date;
  to: Date;
  metrics?: BiomarkerMetric[];
  // pin cycle day 1 to this instant (see cycleAnchorFor); omit for the per-user hash
  cycleAnchorMs?: number;
}

// per-sample noise, seeded by (user, timestamp, metric) — no stream state, so
// determinism holds pointwise, not just per-run.
const noiseAt = (
  userId: string,
  timeMs: number,
  metric: BiomarkerMetric,
): number => gaussian(mulberry32(hashSeed(`${userId}:${timeMs}:${metric}`)));

export const generateSamples = (args: GenerateSamplesArgs): RawSample[] => {
  const metrics = args.metrics ?? biomarkerMetricSchema.options;
  const samples: RawSample[] = [];

  // align to the 5-minute grid so overlapping windows emit identical timestamps
  const start = Math.ceil(args.from.getTime() / INTERVAL_MS) * INTERVAL_MS;
  const end = args.to.getTime();

  for (let time = start; time <= end; time += INTERVAL_MS) {
    const ts = new Date(time);
    const cycleDay = cycleDayFor(args.userId, ts, args.cycleAnchorMs);
    const hourOfDay = ts.getUTCHours() + ts.getUTCMinutes() / 60;

    for (const metric of metrics) {
      const value =
        metricMean(metric, cycleDay, hourOfDay) +
        noiseAt(args.userId, time, metric) * METRIC_CURVES[metric].noiseSigma;

      samples.push({ ts, metric, value: Number(value.toFixed(4)) });
    }
  }

  return samples;
};
