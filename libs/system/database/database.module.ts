import { Global, Module } from '@nestjs/common';

import { AppPrismaProvider, AppPrismaService } from './database.service';

@Global()
@Module({
  providers: [AppPrismaProvider, AppPrismaService],
  exports: [AppPrismaService],
})
export class DatabaseModule {}
