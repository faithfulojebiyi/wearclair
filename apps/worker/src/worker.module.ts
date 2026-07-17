import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

import { MastraRuntimeModule } from '@providers/mastra/mastra-runtime.module';
import { ResendModule } from '@providers/resend/resend.module';
import { StorageModule } from '@providers/storage/storage.module';
import { CacheModule } from '@system/cache/cache.module';
import { CqrsModule } from '@system/cqrs/cqrs.module';
import { DatabaseModule } from '@system/database/database.module';
import { TimeseriesModule } from '@system/timeseries/timeseries.module';
import { PubSubModule } from '@system/pubsub/pubsub.module';
import { AllExceptionsFilter } from '@system/interceptors/error.interceptor';
import { buildLoggerParams } from '@system/logger/logger.config';

import { EventPublisherModule } from './modules/event-publisher/event-publisher.module';
import { InsightsModule } from './modules/insights/insights.module';
import { WorkerController } from './worker.controller';
import { envSchema } from './worker.env.schema';
import { WorkerService } from './worker.service';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildLoggerParams(config),
    }),
    // no AlsModule — als is http-request-scoped and the worker runs background jobs.
    CacheModule,
    CqrsModule,
    DatabaseModule,
    TimeseriesModule,
    PubSubModule,

    // providers
    ResendModule,
    StorageModule,
    // worker-side Mastra access (NOT the HTTP adapter — that's api-only).
    MastraRuntimeModule,

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './apps/worker/.env',
      cache: true,
      validationSchema: envSchema,
    }),

    EventPublisherModule,
    InsightsModule,
  ],
  controllers: [WorkerController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    WorkerService,
  ],
})
export class WorkerModule {}
