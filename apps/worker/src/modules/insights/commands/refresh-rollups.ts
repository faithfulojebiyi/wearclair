import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { BiomarkerStore } from '@system/timeseries/biomarker.store';

/**
 * refresh tsdb rollups before aggregate reads — late syncs land below the cagg
 * watermark and are invisible until materialized.
 */
export class RefreshRollupsCommand extends Command<void> {
  constructor() {
    super();
  }
}

@CommandHandler(RefreshRollupsCommand)
export class RefreshRollupsCommandHandler implements ICommandHandler<RefreshRollupsCommand> {
  constructor(private readonly biomarkerStore: BiomarkerStore) {}

  async execute(_command: RefreshRollupsCommand) {
    await this.biomarkerStore.refreshRollups();
  }
}
