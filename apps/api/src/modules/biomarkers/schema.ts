import { z } from 'zod';

import { dateToString } from '@system/schema/utils';
import {
  biomarkerMetricSchema,
  seriesBucketSchema,
} from '@system/timeseries/timeseries.schema';

export const GetSeriesQuerySchema = z
  .object({
    metric: biomarkerMetricSchema,
    bucket: seriesBucketSchema.default('1h'),
    from: z.iso.datetime(),
    to: z.iso.datetime(),
  })
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
