import { Global, Module } from '@nestjs/common';

import { StorageService } from './storage.service';

// global so any module (api or worker) can inject StorageService without importing.
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
