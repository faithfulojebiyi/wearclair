import { Keyv } from 'keyv';

import { CacheModule as NCacheModule } from '@nestjs/cache-manager';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import KeyvValkey from '@keyv/valkey';

import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    NCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger(CacheModule.name);
        const redisUrl = configService.get<string>('APP_REDIS_URL');

        /**
         * dev without redis falls back to in-memory Keyv so the app still boots;
         * env validation requires APP_REDIS_URL outside dev, so deployed envs
         * never silently lose the shared cache.
         */
        const store = redisUrl
          ? new Keyv({
              store: new KeyvValkey({ uri: redisUrl }),
              namespace: '{same-slot}',
            })
          : new Keyv({ namespace: '{same-slot}' });

        // keyv re-emits valkey connection errors — unhandled they kill the process
        store.on('error', (error) => {
          logger.error({ err: error }, 'cache store errored');
        });

        return {
          isGlobal: true,
          stores: [store],
        };
      },
      inject: [ConfigService],
      isGlobal: true,
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
