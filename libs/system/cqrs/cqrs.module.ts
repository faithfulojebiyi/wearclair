import { Global, Module } from '@nestjs/common';
import { CqrsModule as NCqrsModule } from '@nestjs/cqrs';

@Global()
@Module({
  imports: [NCqrsModule],
  exports: [NCqrsModule],
})
export class CqrsModule {}
