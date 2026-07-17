import { createZodDto } from 'nestjs-zod';

import {
  DailyInsightListSchema,
  DailyInsightSchema,
  GetInsightRangeQuerySchema,
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
