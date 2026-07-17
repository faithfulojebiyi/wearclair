import { createZodDto } from 'nestjs-zod';

import {
  GetSeriesQuerySchema,
  LatestReadingsSchema,
  SeriesSchema,
} from '../schema';

export class GetSeriesQueryDto extends createZodDto(GetSeriesQuerySchema) {}

export class SeriesDto extends createZodDto(SeriesSchema, { codec: true }) {}

export class LatestReadingsDto extends createZodDto(LatestReadingsSchema, {
  codec: true,
}) {}
