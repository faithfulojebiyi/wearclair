import { z } from 'zod';

import { CyclePhase } from '@orm/app';

import { dateToString } from '@system/schema/utils';

export const CyclePhaseSchema = z.enum(CyclePhase).meta({ id: 'CyclePhase' });

export const DailyInsightSchema = z
  .object({
    date: dateToString,
    cycleDay: z.number().int(),
    phase: CyclePhaseSchema,
    basalTempC: z.number(),
    restingHrBpm: z.number(),
    hrvRmssdMs: z.number(),
    readiness: z.number().int(),
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
