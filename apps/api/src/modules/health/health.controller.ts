import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';

import { Public } from '@system/auth/auth.decorators';
import { AppPrismaService } from '@system/database/database.service';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';

@Controller('health')
export class HealthController {
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
