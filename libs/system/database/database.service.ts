import { Injectable, OnModuleInit, Type } from '@nestjs/common';

import { PrismaClient as AppPrismaClient } from '@orm/app';
import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';

@Injectable()
export class AppPrismaProvider extends AppPrismaClient implements OnModuleInit {
  private static initialized = false;

  // the replica-extended client — its $disconnect tears down the replica pool too
  private extended?: { $disconnect(): Promise<void> };

  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.APP_DATABASE_URL,
        // verified TLS outside development — the hosted cert is publicly trusted
        ssl: process.env.NODE_ENV !== 'development' ? true : undefined,
      }),
      omit: {},
      errorFormat: 'minimal',
    });
  }

  async onModuleInit() {
    if (!AppPrismaProvider.initialized) {
      AppPrismaProvider.initialized = true;
      await this.$connect();
    }
  }

  // runs only when the app calls enableShutdownHooks() (both mains do) — disconnect
  // through the extended client so the replica pool closes with the primary.
  async onModuleDestroy() {
    if (AppPrismaProvider.initialized) {
      AppPrismaProvider.initialized = false;
      await (this.extended ?? this).$disconnect();
    }
  }

  // read replicas are transparent — handlers get a single client. the extension
  // requires at least one replica, so with no APP_DATABASE_REPLICA_URL the "replica"
  // is a client on the primary url (lazy pool — no extra connections until read).
  withExtensions() {
    const replicaClient = new AppPrismaClient({
      adapter: new PrismaPg({
        connectionString:
          process.env.APP_DATABASE_REPLICA_URL || process.env.APP_DATABASE_URL,
        ssl: process.env.NODE_ENV !== 'development' ? true : undefined,
      }),
      omit: {},
      errorFormat: 'minimal',
    });

    const extended = this.$extends(readReplicas({ replicas: [replicaClient] }));

    this.extended = extended;

    return extended;
  }
}

const ExtendedPrismaClient = class {
  constructor(provider: AppPrismaProvider) {
    return provider.withExtensions();
  }
} as Type<ReturnType<AppPrismaProvider['withExtensions']>>;

@Injectable()
export class AppPrismaService extends ExtendedPrismaClient {
  constructor(provider: AppPrismaProvider) {
    super(provider);
  }
}
