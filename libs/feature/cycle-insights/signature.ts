/**
 * change-gate signature over the generation window (latest day + 14 baseline
 * days) — a late baseline correction must invalidate the gate. hormones omitted
 * (pure function of cycleDay); fields rounded so float jitter never thrashes.
 */
import { createHash } from 'node:crypto';

import { PerDayInsight } from './classify';

// keep in lockstep with the slice(-15) windows in ai-insights / health-insights
const GENERATION_WINDOW_DAYS = 15;

export const healthInsightSignature = (days: PerDayInsight[]): string => {
  if (days.length === 0) {
    return '';
  }

  const canonical = JSON.stringify(
    days.slice(-GENERATION_WINDOW_DAYS).map((day) => [
      day.cycleDay,
      day.phase,
      day.readiness,
      Math.round(day.basalTempC * 10) / 10, // 1 dp
      Math.round(day.restingHrBpm), // integer
      Math.round(day.hrvRmssdMs), // integer
    ]),
  );

  return createHash('sha1').update(canonical).digest('hex');
};
