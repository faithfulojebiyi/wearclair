import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';

import { Public } from '@system/auth/auth.decorators';
import { AppPrismaService } from '@system/database/database.service';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';

// unauthenticated endpoint that pings both databases — memoize briefly so
// hammering it can't multiply db load
const HEALTH_CACHE_MS = 5000;

@Controller('health')
export class HealthController {
  private lastCheck: {
    at: number;
    result: ReturnType<HealthCheckService['check']>;
  } | null = null;

  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicator: HealthIndicatorService,
    private readonly biomarkerStore: BiomarkerStore,
    private readonly appPrismaService: AppPrismaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    const now = Date.now();

    if (this.lastCheck && now - this.lastCheck.at < HEALTH_CACHE_MS) {
      return this.lastCheck.result;
    }

    const result = this.runChecks();

    this.lastCheck = { at: now, result };

    return result;
  }

  private runChecks() {
    return this.health.check([
      async () => {
        const indicator = this.healthIndicator.check('tsdb');

        try {
          await this.biomarkerStore.ping();

          return indicator.up();
        } catch {
          return indicator.down();
        }
      },
      // app postgres carries auth + every relational read — the api is not
      // healthy on tsdb alone
      async () => {
        const indicator = this.healthIndicator.check('db');

        try {
          await this.appPrismaService.$primary().$queryRaw`SELECT 1`;

          return indicator.up();
        } catch {
          return indicator.down();
        }
      },
    ]);
  }
}
