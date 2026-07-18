import { z } from 'zod';

import { CyclePhaseSchema } from '@feature/cycle-insights/phase';

import { dateToString } from '@system/schema/utils';

// re-exported so existing importers keep resolving it from here
export { CyclePhaseSchema };

export const HormoneEstimateSchema = z
  .object({
    estradiolPgMl: z.number(),
    progesteroneNgMl: z.number(),
    lhMiuMl: z.number(),
    fshMiuMl: z.number(),
  })
  .meta({ id: 'HormoneEstimate' });

export const DailyInsightSchema = z
  .object({
    date: dateToString,
    cycleDay: z.number().int(),
    phase: CyclePhaseSchema,
    basalTempC: z.number(),
    restingHrBpm: z.number(),
    hrvRmssdMs: z.number(),
    readiness: z.number().int(),
    hormones: HormoneEstimateSchema,
    // lineage: the raw tsdb window this insight derives from
    sourceFrom: dateToString,
    sourceTo: dateToString,
    sourceSampleCount: z.number().int(),
  })
  .meta({ id: 'DailyInsight' });

export const DailyInsightListSchema = z
  .object({
    insights: z.array(DailyInsightSchema),
  })
  .meta({ id: 'DailyInsightList' });

export const GetInsightRangeQuerySchema = z
  .object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
  })
  .meta({ id: 'GetInsightRangeQuery' });

// the Insights feed — worker-generated (AI/rule) health insight cards. category and
// priority are validated here (the zod boundary), not as db enums.
export const healthInsightCategorySchema = z
  .enum(['fertility', 'energy', 'cycle', 'recovery', 'vitals'])
  .meta({ id: 'HealthInsightCategory' });

export const healthInsightPrioritySchema = z
  .enum(['high', 'normal', 'low'])
  .meta({ id: 'HealthInsightPriority' });

export const HealthInsightSchema = z
  .object({
    id: z.string(),
    date: dateToString,
    // read is lenient (plain string) so historical rows survive a category change
    category: z.string(),
    priority: z.string(),
    title: z.string(),
    body: z.string(),
    detail: z.string().nullable(),
    createdAt: dateToString,
  })
  .meta({ id: 'HealthInsight' });

export const HealthInsightListSchema = z
  .object({ insights: z.array(HealthInsightSchema) })
  .meta({ id: 'HealthInsightList' });

export const GetHealthInsightsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .meta({ id: 'GetHealthInsightsQuery' });
