import { describe, expect, it } from 'bun:test';

import { PerDayInsight } from './classify';
import { estimateHormones } from './hormones';
import { CyclePhase } from './phase';
import { buildHealthInsightDrafts } from './health-insights';

const DAY_MS = 24 * 60 * 60 * 1000;

// a synthetic history of `count` days ending today, with the last day overridden.
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

describe('buildHealthInsightDrafts', () => {
  it('returns nothing for an empty history', () => {
    expect(buildHealthInsightDrafts([])).toEqual([]);
  });

  it('always includes a cycle-day anchor with a unique key set', () => {
    const drafts = buildHealthInsightDrafts(history(15, {}));
    const keys = drafts.map((d) => d.key);

    expect(keys).toContain('cycle-day');
    // keys must be unique — they are the per-day upsert dedup dimension
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('emits a high-priority fertility card in the ovulatory phase', () => {
    const drafts = buildHealthInsightDrafts(
      history(15, { phase: CyclePhase.OVULATORY, cycleDay: 14 }),
    );
    const fertility = drafts.find((d) => d.category === 'fertility');

    expect(fertility?.priority).toBe('high');
    expect(fertility?.detail).toMatch(/Estrogen/);
  });

  it('flags low recovery when readiness is suppressed', () => {
    const drafts = buildHealthInsightDrafts(
      history(15, { readiness: 40, hrvRmssdMs: 48 }),
    );
    const recovery = drafts.find((d) => d.key === 'low-recovery');

    expect(recovery).toBeDefined();
    expect(recovery?.priority).toBe('high');
  });

  it('reports a luteal card with progesterone detail in the luteal phase', () => {
    const drafts = buildHealthInsightDrafts(
      history(20, { phase: CyclePhase.LUTEAL, cycleDay: 20 }),
    );
    const luteal = drafts.find((d) => d.key === 'luteal-phase');

    expect(luteal?.detail).toMatch(/Progesterone/);
  });
});
