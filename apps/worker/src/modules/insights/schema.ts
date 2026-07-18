import { z } from 'zod';

// JSON-safe daily stat crossing the inngest step boundary (memoized step results
// replay as plain JSON, so dates travel as ISO strings). Only the metrics the
// classifier consumes.
export const insightDailyStatSchema = z
  .object({
    day: z.iso.datetime(),
    metric: z.enum(['skin_temp', 'heart_rate', 'hrv']),
    avg: z.number(),
    min: z.number(),
    max: z.number(),
    count: z.number().int(),
  })
  .meta({ id: 'InsightDailyStat' });

export type InsightDailyStat = z.infer<typeof insightDailyStatSchema>;

export const upsertInsightsResultSchema = z
  .object({
    upserted: z.number().int(),
    // set by the change-gated health-insight refresh when the day's signature was
    // unchanged, so nothing was generated or written
    skipped: z.boolean().optional(),
  })
  .meta({ id: 'UpsertInsightsResult' });

export type UpsertInsightsResult = z.infer<typeof upsertInsightsResultSchema>;
