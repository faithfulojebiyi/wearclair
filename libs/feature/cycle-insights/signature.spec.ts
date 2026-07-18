import { describe, expect, it } from 'bun:test';

import { PerDayInsight } from './classify';
import { estimateHormones } from './hormones';
import { CyclePhase } from './phase';
import { healthInsightSignature } from './signature';

const DAY_MS = 24 * 60 * 60 * 1000;

// synthetic ascending history; only the last day drives the signature.
const history = (
  count: number,
  last: Partial<PerDayInsight>,
): PerDayInsight[] => {
  const base = new Date('2026-05-01T00:00:00.000Z');

  return Array.from({ length: count }, (_, i) => {
    const cycleDay = (i % 28) + 1;

    return {
      date: new Date(base.getTime() + i * DAY_MS),
      cycleDay,
      phase: CyclePhase.FOLLICULAR,
      basalTempC: 36.4,
      restingHrBpm: 62,
      hrvRmssdMs: 65,
      readiness: 75,
      hormones: estimateHormones(cycleDay),
      ...(i === count - 1 ? last : {}),
    } satisfies PerDayInsight;
  });
};

describe('healthInsightSignature', () => {
  it('is empty for an empty history', () => {
    expect(healthInsightSignature([])).toBe('');
  });

  it('is stable for identical inputs', () => {
    expect(healthInsightSignature(history(15, {}))).toBe(
      healthInsightSignature(history(15, {})),
    );
  });

  it('changes when a meaningful field changes', () => {
    const a = healthInsightSignature(history(15, { readiness: 75 }));
    const b = healthInsightSignature(history(15, { readiness: 40 }));

    expect(a).not.toBe(b);
  });

  it('ignores sub-threshold float noise (rounds hrv to integer)', () => {
    const a = healthInsightSignature(history(15, { hrvRmssdMs: 42.3 }));
    const b = healthInsightSignature(history(15, { hrvRmssdMs: 42.4 }));

    expect(a).toBe(b);
  });

  it('depends only on the latest day, not earlier days', () => {
    const days = history(15, {});
    const mutated = history(15, {});
    mutated[0] = { ...mutated[0], readiness: 10 };

    expect(healthInsightSignature(days)).toBe(healthInsightSignature(mutated));
  });
});
