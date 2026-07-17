import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// identity attached to every published event so consumers know who triggered it.
// extend as auth/tenancy lands.
export const eventUserSchema = z
  .object({
    userId: z.string(),
  })
  .meta({ id: 'EventUser' });

export class EventUserDto extends createZodDto(eventUserSchema) {}
