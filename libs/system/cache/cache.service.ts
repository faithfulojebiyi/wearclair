import type { Cache } from 'cache-manager';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class CacheService<
  T extends Record<string, any> = Record<string, unknown>,
> {
  constructor(@Inject(CACHE_MANAGER) private cacheService: Cache) {}

  async set<K extends keyof T>(key: K, value: T[K], ttl = 0) {
    // ttl = 0 means no expiration, other values are in milliseconds
    return await this.cacheService.set(key as string, value, ttl);
  }

  async get<K extends keyof T>(key: K): Promise<T[K] | null> {
    return await this.cacheService.get<any>(key as string);
  }

  async del<K extends keyof T>(key: K) {
    await this.cacheService.del(key as string);
  }

  async delMany(keys: Array<keyof T>) {
    for (const key of keys) {
      await this.cacheService.del(key as string);
    }
  }

  async reset() {
    await this.cacheService.clear();
  }
}
