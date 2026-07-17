import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import { DeviceDto, RegisterDeviceDto } from '../dto/devices.dto';

export class RegisterDeviceCommand extends Command<DeviceDto> {
  constructor(public readonly dto: RegisterDeviceDto) {
    super();
  }
}

@CommandHandler(RegisterDeviceCommand)
export class RegisterDeviceCommandHandler implements ICommandHandler<RegisterDeviceCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute(command: RegisterDeviceCommand) {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const device = await this.appPrismaService.device.create({
      data: {
        userId,
        name: command.dto.name,
        ...(command.dto.model ? { model: command.dto.model } : {}),
      },
    });

    return {
      id: device.id,
      name: device.name,
      model: device.model,
      lastSyncedAt: device.lastSyncedAt,
      createdAt: device.createdAt,
    };
  }
}
