import { Module } from '@nestjs/common';

import { IngestBatchCommandHandler } from './commands/ingest-batch';
import { RegisterDeviceCommandHandler } from './commands/register-device';
import { SimulateSyncCommandHandler } from './commands/simulate-sync';
import { DevicesController } from './devices.controller';
import { ListDevicesQueryHandler } from './queries/list-devices';

@Module({
  controllers: [DevicesController],
  providers: [
    RegisterDeviceCommandHandler,
    IngestBatchCommandHandler,
    SimulateSyncCommandHandler,
    ListDevicesQueryHandler,
  ],
})
export class DevicesModule {}
