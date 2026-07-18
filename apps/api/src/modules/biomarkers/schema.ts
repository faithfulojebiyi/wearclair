import { z } from 'zod';

import { dateRangeWithin, dateToString } from '@system/schema/utils';
import {
  SeriesBucket,
  biomarkerMetricSchema,
  seriesBucketSchema,
} from '@system/timeseries/timeseries.schema';

// per-bucket range caps: 5m hits the raw hypertable (expensive), so a day max;
// the 1h/1d continuous aggregates tolerate wider windows.
const BUCKET_MAX_DAYS: Record<SeriesBucket, number> = {
  '5m': 1,
  '1h': 31,
  '1d': 400,
};

export const GetSeriesQuerySchema = z
  .object({
    metric: biomarkerMetricSchema,
    bucket: seriesBucketSchema.default('1h'),
    from: z.iso.datetime(),
    to: z.iso.datetime(),
  })
  .superRefine((value, ctx) =>
    dateRangeWithin(BUCKET_MAX_DAYS[value.bucket])(value, ctx),
  )
  .meta({ id: 'GetSeriesQuery' });

export const SeriesPointSchema = z
  .object({
    ts: dateToString,
    avg: z.number(),
    min: z.number(),
    max: z.number(),
    count: z.number().int(),
  })
  .meta({ id: 'SeriesPoint' });

export const SeriesSchema = z
  .object({
    metric: biomarkerMetricSchema,
    bucket: seriesBucketSchema,
    points: z.array(SeriesPointSchema),
  })
  .meta({ id: 'Series' });

export const LatestReadingSchema = z
  .object({
    metric: biomarkerMetricSchema,
    ts: dateToString,
    value: z.number(),
  })
  .meta({ id: 'LatestReading' });

export const LatestReadingsSchema = z
  .object({
    readings: z.array(LatestReadingSchema),
  })
  .meta({ id: 'LatestReadings' });
