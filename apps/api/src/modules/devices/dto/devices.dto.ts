import { createZodDto } from 'nestjs-zod';

import {
  DeviceListSchema,
  DeviceSchema,
  IngestBatchSchema,
  RegisterDeviceSchema,
  SyncResultSchema,
} from '../schema';

export class RegisterDeviceDto extends createZodDto(RegisterDeviceSchema) {}

// request body carries ISO timestamps; the codec decodes them to Dates on parse
export class IngestBatchDto extends createZodDto(IngestBatchSchema) {}

export class DeviceDto extends createZodDto(DeviceSchema, { codec: true }) {}

export class DeviceListDto extends createZodDto(DeviceListSchema, {
  codec: true,
}) {}

export class SyncResultDto extends createZodDto(SyncResultSchema, {
  codec: true,
}) {}
