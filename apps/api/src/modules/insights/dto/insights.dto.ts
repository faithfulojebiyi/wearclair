import { createZodDto } from 'nestjs-zod';

import {
  DailyInsightListSchema,
  DailyInsightSchema,
  GetHealthInsightsQuerySchema,
  GetInsightRangeQuerySchema,
  HealthInsightListSchema,
} from '../schema';

export class DailyInsightDto extends createZodDto(DailyInsightSchema, {
  codec: true,
}) {}

export class DailyInsightListDto extends createZodDto(DailyInsightListSchema, {
  codec: true,
}) {}

export class GetInsightRangeQueryDto extends createZodDto(
  GetInsightRangeQuerySchema,
) {}

export class HealthInsightListDto extends createZodDto(
  HealthInsightListSchema,
  {
    codec: true,
  },
) {}

export class GetHealthInsightsQueryDto extends createZodDto(
  GetHealthInsightsQuerySchema,
) {}
