import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { BiomarkerStore } from '@system/timeseries/biomarker.store';

// materialize the tsdb rollups before any aggregate read: an offline/late sync
// lands below the cagg watermark, where real-time aggregates serve the stale
// materialization — without this, daily stats can miss the very batch being
// processed.
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
