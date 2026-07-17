import { ClsModule } from 'nestjs-cls';

import { Global, Module } from '@nestjs/common';

import { AlsService } from './als.service';

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
  ],
  providers: [AlsService],
  exports: [AlsService],
})
export class AlsModule {}
