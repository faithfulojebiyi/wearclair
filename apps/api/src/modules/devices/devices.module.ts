import { Module } from '@nestjs/common';

import { IngestBatchCommandHandler } from './commands/ingest-batch';
import { RegisterDeviceCommandHandler } from './commands/register-device';
import { RepublishStaleBatchesCommandHandler } from './commands/republish-stale-batches';
import { SimulateSyncCommandHandler } from './commands/simulate-sync';
import { DevicesController } from './devices.controller';
import { GetRealtimeTokenQueryHandler } from './queries/get-realtime-token';
import { ListDevicesQueryHandler } from './queries/list-devices';

@Module({
  controllers: [DevicesController],
  providers: [
    RegisterDeviceCommandHandler,
    IngestBatchCommandHandler,
    RepublishStaleBatchesCommandHandler,
    SimulateSyncCommandHandler,
    ListDevicesQueryHandler,
    GetRealtimeTokenQueryHandler,
  ],
})
export class DevicesModule {}
