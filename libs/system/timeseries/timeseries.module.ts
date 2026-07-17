import { Global, Module } from '@nestjs/common';

import { BiomarkerStore } from './biomarker.store';
import { TsdbPool } from './timeseries.pool';

@Global()
@Module({
  providers: [TsdbPool, BiomarkerStore],
  exports: [BiomarkerStore],
})
export class TimeseriesModule {}
