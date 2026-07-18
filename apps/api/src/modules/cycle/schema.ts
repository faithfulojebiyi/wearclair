import { z } from 'zod';

import { CyclePhaseSchema } from '@feature/cycle-insights/phase';

import { dateRangeWithin, dateToString } from '@system/schema/utils';

// the allowed log categories live HERE (zod), not in a db enum — adding one is a
// one-line change, no migration. Input is validated against this; stored as a string.
// mirrors the mobile Track catalog (mobile/src/modules/cycle/catalog.ts).
export const cycleLogTypeSchema = z
  .enum([
    'period',
    'flow',
    'symptom',
    'mood',
    'sex',
    'cervical_mucus',
    'cervix_position',
    'cervix_status',
    'cervix_texture',
    'ovulation_test',
    'pregnancy_test',
    'breast_exam',
    'medicine',
    'energy',
    'diary',
    'tag',
  ])
  .meta({ id: 'CycleLogType' });

export const CreateCycleLogSchema = z
  .object({
    type: cycleLogTypeSchema,
    value: z.string().min(1).max(500),
    note: z.string().max(500).optional(),
    // the calendar day the entry belongs to; defaults to today when omitted
    date: z.iso.datetime().optional(),
  })
  .meta({ id: 'CreateCycleLog' });

// upsert a single category for a day. empty value deletes the row (deselect-all).
export const UpsertCycleLogSchema = z
  .object({
    type: cycleLogTypeSchema,
    value: z.string().max(500),
    note: z.string().max(500).optional(),
    date: z.iso.datetime(),
  })
  .meta({ id: 'UpsertCycleLog' });

export const CycleLogSchema = z
  .object({
    id: z.string(),
    // read is lenient (plain string) so historical rows survive a future type change
    type: z.string(),
    value: z.string(),
    note: z.string().nullable(),
    date: dateToString,
    loggedAt: dateToString,
  })
  .meta({ id: 'CycleLog' });

export const CycleLogListSchema = z
  .object({ logs: z.array(CycleLogSchema) })
  .meta({ id: 'CycleLogList' });

const PredictionSchema = z
  .object({ date: dateToString, inDays: z.number().int() })
  .meta({ id: 'Prediction' });

export const CyclePredictionsSchema = z
  .object({
    cycleDay: z.number().int(),
    phase: CyclePhaseSchema,
    ovulation: PredictionSchema,
    nextPeriod: PredictionSchema,
    fertileWindow: z
      .object({
        start: dateToString,
        end: dateToString,
        active: z.boolean(),
      })
      .meta({ id: 'FertileWindow' }),
  })
  .meta({ id: 'CyclePredictions' });

// per-day cell state for the calendar grid (derived, not stored)
export const CycleDaySchema = z
  .object({
    date: dateToString,
    cycleDay: z.number().int().nullable(),
    phase: CyclePhaseSchema.nullable(),
    isPeriod: z.boolean(),
    isFertile: z.boolean(),
    isOvulation: z.boolean(),
    isPredicted: z.boolean(),
  })
  .meta({ id: 'CycleDay' });

export const CycleCalendarSchema = z
  .object({ days: z.array(CycleDaySchema) })
  .meta({ id: 'CycleCalendar' });

// capped: the handler derives one day object per requested day, so range size —
// not the user's data — bounds the work.
export const GetCycleCalendarQuerySchema = z
  .object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
  })
  .superRefine(dateRangeWithin(400))
  .meta({ id: 'GetCycleCalendarQuery' });

// timeline entries: period start/end markers + symptom/mood logs
export const CycleTimelineEntrySchema = z
  .object({
    id: z.string(),
    date: dateToString,
    kind: z.string(), // period_start | period_end | symptom | mood
    label: z.string(),
    detail: z.string().nullable(),
  })
  .meta({ id: 'CycleTimelineEntry' });

export const CycleTimelineSchema = z
  .object({ entries: z.array(CycleTimelineEntrySchema) })
  .meta({ id: 'CycleTimeline' });

// a single day's derived state + all its logs — powers the Track screen prefill and
// the calendar's selected-day card.
export const GetCycleDayQuerySchema = z
  .object({ date: z.iso.datetime() })
  .meta({ id: 'GetCycleDayQuery' });

export const CycleDaySummarySchema = z
  .object({
    date: dateToString,
    cycleDay: z.number().int().nullable(),
    phase: CyclePhaseSchema.nullable(),
    isPeriod: z.boolean(),
    isFertile: z.boolean(),
    isOvulation: z.boolean(),
    isPredicted: z.boolean(),
    fertilityChance: z.string(),
    logs: z.array(CycleLogSchema),
  })
  .meta({ id: 'CycleDaySummary' });

/**
 * Edit-period SAVE: replace the logged period days within [from, to] with `dates`.
 * same 400d cap as the calendar. every entry must fall inside the window — an
 * out-of-window date would be written invisibly and never be removable here.
 */
export const SetPeriodSchema = z
  .object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    dates: z.array(z.iso.datetime()).max(400),
  })
  .superRefine(dateRangeWithin(400))
  .superRefine((value, ctx) => {
    // day-level bounds; iso day keys compare lexicographically
    const fromKey = value.from.slice(0, 10);
    const toKey = value.to.slice(0, 10);

    value.dates.forEach((date, index) => {
      const key = date.slice(0, 10);

      if (key < fromKey || key > toKey) {
        ctx.addIssue({
          code: 'custom',
          path: ['dates', index],
          message: 'date must fall within [from, to]',
        });
      }
    });
  })
  .meta({ id: 'SetPeriod' });
