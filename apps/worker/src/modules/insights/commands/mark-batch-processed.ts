import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AppPrismaService } from '@system/database/database.service';
import { SYNC_BATCH_STATUS } from '@system/schema/sync-batch.schema';

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
      data: {
        status: SYNC_BATCH_STATUS.PROCESSED,
        processedAt: new Date(),
      },
    });
  }
}
