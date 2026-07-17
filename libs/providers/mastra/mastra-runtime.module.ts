import { Global, Module } from '@nestjs/common';

import { MastraRuntimeService } from './mastra-runtime.service';

// Worker-side Mastra access (NOT the nestjs HTTP adapter, which is api-only).
// Global so any worker job can resolve agents/workflows via MastraRuntimeService.
@Global()
@Module({
  providers: [MastraRuntimeService],
  exports: [MastraRuntimeService],
})
export class MastraRuntimeModule {}
