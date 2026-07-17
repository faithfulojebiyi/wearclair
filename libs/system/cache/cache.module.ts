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
        return {
          isGlobal: true,
          stores: [
            new Keyv({
              store: new KeyvValkey({
                uri: configService.get('APP_REDIS_URL'),
              }),
              namespace: '{same-slot}',
            }),
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
