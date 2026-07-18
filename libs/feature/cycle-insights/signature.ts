// content signature of the LATEST day, used to change-gate AI card regeneration.
// hormones are omitted: estimateHormones(cycleDay) is a pure function of cycleDay,
// so cycleDay already captures them. fields are rounded so float jitter (e.g. hrv
// 42.3 vs 42.4) never thrashes the gate.
import { createHash } from 'node:crypto';

import { PerDayInsight } from './classify';

export const healthInsightSignature = (days: PerDayInsight[]): string => {
  if (days.length === 0) {
    return '';
  }

  const today = days[days.length - 1];

  const canonical = JSON.stringify([
    today.cycleDay,
    today.phase,
    today.readiness,
    Math.round(today.basalTempC * 10) / 10, // 1 dp
    Math.round(today.restingHrBpm), // integer
    Math.round(today.hrvRmssdMs), // integer
  ]);

  return createHash('sha1').update(canonical).digest('hex');
};
