import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';

import { Public } from '@system/auth/auth.decorators';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicator: HealthIndicatorService,
    private readonly biomarkerStore: BiomarkerStore,
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
    ]);
  }
}
