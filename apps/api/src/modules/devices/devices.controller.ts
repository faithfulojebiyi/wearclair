import { ZodResponse } from 'nestjs-zod';

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';

import { IngestBatchCommand } from './commands/ingest-batch';
import { RegisterDeviceCommand } from './commands/register-device';
import { SimulateSyncCommand } from './commands/simulate-sync';
import {
  DeviceDto,
  DeviceListDto,
  IngestBatchDto,
  RegisterDeviceDto,
  SyncResultDto,
} from './dto/devices.dto';
import { ListDevicesQuery } from './queries/list-devices';

@ApiTags('Devices')
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @ZodResponse({ type: DeviceDto })
  @Post()
  async registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.commandBus.execute(new RegisterDeviceCommand(dto));
  }

  @ZodResponse({ type: DeviceListDto })
  @Get()
  async listDevices() {
    return this.queryBus.execute(new ListDevicesQuery());
  }

  @ZodResponse({ type: SyncResultDto })
  @Post(':deviceId/sync')
  async syncDevice(
    @Param('deviceId') deviceId: string,
    @Body() dto: IngestBatchDto,
  ) {
    return this.commandBus.execute(new IngestBatchCommand(deviceId, dto));
  }

  @ZodResponse({ type: SyncResultDto })
  @Post(':deviceId/simulate-sync')
  async simulateSync(@Param('deviceId') deviceId: string) {
    return this.commandBus.execute(new SimulateSyncCommand(deviceId));
  }
}
