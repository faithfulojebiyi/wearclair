import { Keyv } from 'keyv';

import { CacheModule as NCacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import KeyvValkey from '@keyv/valkey';

import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    NCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('APP_REDIS_URL');

        // dev without redis falls back to in-memory Keyv so the app still boots;
        // env validation requires APP_REDIS_URL outside dev, so deployed envs
        // never silently lose the shared cache.
        return {
          isGlobal: true,
          stores: [
            redisUrl
              ? new Keyv({
                  store: new KeyvValkey({ uri: redisUrl }),
                  namespace: '{same-slot}',
                })
              : new Keyv({ namespace: '{same-slot}' }),
          ],
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
