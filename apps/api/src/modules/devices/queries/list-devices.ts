import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import { DeviceListDto } from '../dto/devices.dto';

export class ListDevicesQuery extends Query<DeviceListDto> {
  constructor() {
    super();
  }
}

@QueryHandler(ListDevicesQuery)
export class ListDevicesQueryHandler implements IQueryHandler<ListDevicesQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute() {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const devices = await this.appPrismaService.device.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      devices: devices.map((device) => ({
        id: device.id,
        name: device.name,
        model: device.model,
        lastSyncedAt: device.lastSyncedAt,
        createdAt: device.createdAt,
      })),
    };
  }
}
