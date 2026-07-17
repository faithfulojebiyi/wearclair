import { z } from 'zod';

import { dateToString } from '@system/schema/utils';

// the metric whitelist — the single source of truth for what the firehose accepts.
// adding a biomarker is a new enum value here, not a tsdb DDL change (narrow-table):
// one row per (user, device, metric, ts) means a 6th or a 130th metric is data, not
// schema. Mapped to Clair's published sensing domains (thermoregulatory, autonomic,
// cardiovascular, electrodermal, bioimpedance, respiratory, activity).
export const biomarkerMetricSchema = z
  .enum([
    'skin_temp',
    'heart_rate',
    'hrv',
    'respiratory_rate',
    'eda',
    'arterial_stiffness',
    'perfusion_index',
    'spo2',
    'bioimpedance',
    'motion_index',
  ])
  .meta({ id: 'BiomarkerMetric' });
export type BiomarkerMetric = z.infer<typeof biomarkerMetricSchema>;

// 5m reads hit the raw hypertable; 1h/1d hit the continuous aggregates.
export const seriesBucketSchema = z
  .enum(['5m', '1h', '1d'])
  .meta({ id: 'SeriesBucket' });
export type SeriesBucket = z.infer<typeof seriesBucketSchema>;

export const biomarkerSampleSchema = z
  .object({
    ts: dateToString,
    metric: biomarkerMetricSchema,
    value: z.number(),
  })
  .meta({ id: 'BiomarkerSample' });
export type BiomarkerSample = z.infer<typeof biomarkerSampleSchema>;
