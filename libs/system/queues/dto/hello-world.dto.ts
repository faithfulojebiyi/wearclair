import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const helloWorldSchema = z
  .object({
    message: z.string().optional(),
  })
  .meta({ id: 'HelloWorld' });

export class HelloWorldDto extends createZodDto(helloWorldSchema) {}
