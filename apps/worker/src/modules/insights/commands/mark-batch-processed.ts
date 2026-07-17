import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AppPrismaService } from '@system/database/database.service';

export class MarkBatchProcessedCommand extends Command<void> {
  constructor(public readonly batchId: string) {
    super();
  }
}

@CommandHandler(MarkBatchProcessedCommand)
export class MarkBatchProcessedCommandHandler implements ICommandHandler<MarkBatchProcessedCommand> {
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute(command: MarkBatchProcessedCommand) {
    await this.appPrismaService.syncBatch.update({
      where: { id: command.batchId },
      data: { status: 'PROCESSED' },
    });
  }
}
