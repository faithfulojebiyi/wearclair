import { createZodDto } from 'nestjs-zod';

import {
  CreateCycleLogSchema,
  CycleCalendarSchema,
  CycleDaySummarySchema,
  CycleLogListSchema,
  CycleLogSchema,
  CyclePredictionsSchema,
  CycleTimelineSchema,
  GetCycleCalendarQuerySchema,
  GetCycleDayQuerySchema,
  SetPeriodSchema,
  UpsertCycleLogSchema,
} from '../schema';

export class CreateCycleLogDto extends createZodDto(CreateCycleLogSchema) {}

export class UpsertCycleLogDto extends createZodDto(UpsertCycleLogSchema) {}

export class SetPeriodDto extends createZodDto(SetPeriodSchema) {}

export class GetCycleDayQueryDto extends createZodDto(GetCycleDayQuerySchema) {}

export class CycleDaySummaryDto extends createZodDto(CycleDaySummarySchema, {
  codec: true,
}) {}

export class CycleLogDto extends createZodDto(CycleLogSchema, {
  codec: true,
}) {}

export class CycleLogListDto extends createZodDto(CycleLogListSchema, {
  codec: true,
}) {}

export class CyclePredictionsDto extends createZodDto(CyclePredictionsSchema, {
  codec: true,
}) {}

export class CycleCalendarDto extends createZodDto(CycleCalendarSchema, {
  codec: true,
}) {}

export class GetCycleCalendarQueryDto extends createZodDto(
  GetCycleCalendarQuerySchema,
) {}

export class CycleTimelineDto extends createZodDto(CycleTimelineSchema, {
  codec: true,
}) {}
