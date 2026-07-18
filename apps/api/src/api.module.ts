import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

import { getMastra } from '@providers/mastra/mastra';
import { MastraModule } from '@providers/mastra/nestjs';
import { ResendModule } from '@providers/resend/resend.module';
import { StorageModule } from '@providers/storage/storage.module';
import { AlsModule } from '@system/als/als.module';
import { AuthModule } from '@system/auth/auth.module';
import { CacheModule } from '@system/cache/cache.module';
import { CqrsModule } from '@system/cqrs/cqrs.module';
import { DatabaseModule } from '@system/database/database.module';
import { TimeseriesModule } from '@system/timeseries/timeseries.module';
import { AllExceptionsFilter } from '@system/interceptors/error.interceptor';
import { buildLoggerParams } from '@system/logger/logger.config';

import { ApiController } from './api.controller';
import { envSchema } from './api.env.schema';
import { ApiService } from './api.service';
import { BiomarkersModule } from './modules/biomarkers/biomarkers.module';
import { CycleModule } from './modules/cycle/cycle.module';
import { DevicesModule } from './modules/devices/devices.module';
import { EventPublisherModule } from './modules/event-publisher/event-publisher.module';
import { HealthModule } from './modules/health/health.module';
import { InsightsModule } from './modules/insights/insights.module';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildLoggerParams(config),
    }),
    // als is http-request-scoped — api only (the worker must not import it).
    AlsModule,
    // registers the global SessionGuard (every route needs a session unless @Public()).
    AuthModule,
    CacheModule,
    CqrsModule,
    DatabaseModule,
    TimeseriesModule,

    // providers
    // Mastra (our Fastify fork of @mastra/nestjs): serves agent routes under
    // /mastra/* AND exposes MastraService + the MASTRA token. Global so feature
    // modules can inject MastraService without re-registering. registerAsync +
    // ConfigService inject guarantees ConfigModule has loaded the env
    // (MASTRA_DATABASE_URL) before getMastra() builds the PostgresStore.
    MastraModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (_config: ConfigService) => ({ mastra: getMastra() }),
    }),
    ResendModule,
    StorageModule,

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './apps/api/.env',
      cache: true,
      validationSchema: envSchema,
    }),

    EventPublisherModule,
    HealthModule,
    DevicesModule,
    BiomarkersModule,
    InsightsModule,
    CycleModule,
  ],
  controllers: [ApiController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ApiService,
  ],
})
export class ApiModule {}
