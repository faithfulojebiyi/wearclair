// deterministic health-insight rule engine — turns the derived per-day insights into
// the natural-language cards shown on the Insights feed. Pure + testable. This is the
// FALLBACK for the AI path (ai-insights.ts): same HealthInsightDraft[] shape, so the
// worker can use either. Only real, derived data drives these — never fabricated.

import { PerDayInsight } from './classify';
import { CyclePhase } from './phase';

export type InsightCategory =
  'fertility' | 'energy' | 'cycle' | 'recovery' | 'vitals';

export type InsightPriority = 'high' | 'normal' | 'low';

export interface HealthInsightDraft {
  // stable per-rule slug — the dedup key for idempotent per-day upserts
  key: string;
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  body: string;
  detail?: string;
}

const mean = (values: number[]): number =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

// build the feed for the LATEST day, using recent history for baselines/deltas.
// `days` is ascending by date.
export const buildHealthInsightDrafts = (
  days: PerDayInsight[],
): HealthInsightDraft[] => {
  if (days.length === 0) {
    return [];
  }

  const today = days[days.length - 1];
  const prior = days.slice(Math.max(0, days.length - 15), days.length - 1);

  const hrvBaseline = mean(prior.map((d) => d.hrvRmssdMs));
  const hrBaseline = mean(prior.map((d) => d.restingHrBpm));

  const drafts: HealthInsightDraft[] = [];

  // ── fertility: the fertile window / ovulation signal ────────────────────────
  if (today.phase === CyclePhase.OVULATORY) {
    drafts.push({
      key: 'fertile-window-open',
      category: 'fertility',
      priority: 'high',
      title: 'Fertile Window Open',
      body: `Your estrogen is high and LH is surging — ovulation is likely within a day or two. This is your most fertile time.`,
      detail: `Estrogen ${Math.round(today.hormones.estradiolPgMl)} pg/mL · LH ${today.hormones.lhMiuMl.toFixed(1)} mIU/mL`,
    });
  } else if (today.phase === CyclePhase.FOLLICULAR && today.cycleDay >= 10) {
    drafts.push({
      key: 'fertile-window-approaching',
      category: 'fertility',
      priority: 'normal',
      title: 'Fertile Window Approaching',
      body: `Estrogen is climbing as you head toward ovulation. Fertility rises over the next few days.`,
      detail: `Estrogen ${Math.round(today.hormones.estradiolPgMl)} pg/mL`,
    });
  }

  // ── energy: high-estrogen follicular focus window ───────────────────────────
  if (
    (today.phase === CyclePhase.FOLLICULAR ||
      today.phase === CyclePhase.OVULATORY) &&
    today.hormones.estradiolPgMl > 150
  ) {
    drafts.push({
      key: 'peak-energy',
      category: 'energy',
      priority: 'normal',
      title: 'Peak Energy Window',
      body: `High estrogen enhances energy, focus, and verbal fluency. A good day for important meetings or challenging workouts.`,
    });
  }

  // ── cycle: luteal / progesterone signature ──────────────────────────────────
  if (today.phase === CyclePhase.LUTEAL) {
    drafts.push({
      key: 'luteal-phase',
      category: 'cycle',
      priority: 'normal',
      title: 'Luteal Phase',
      body: `Progesterone is elevated — expect a slightly higher body temperature and resting heart rate, and a dip in HRV. Prioritise rest and steady nutrition.`,
      detail: `Progesterone ${today.hormones.progesteroneNgMl.toFixed(1)} ng/mL`,
    });
  }

  if (today.phase === CyclePhase.MENSTRUAL) {
    drafts.push({
      key: 'new-cycle',
      category: 'cycle',
      priority: 'normal',
      title: 'A New Cycle Begins',
      body: `Temperature has settled back to baseline — day ${today.cycleDay} of your cycle. Hormones are at their lowest; be gentle with yourself.`,
    });
  }

  // ── recovery: readiness / HRV suppression ───────────────────────────────────
  if (today.readiness < 55 && hrvBaseline > 0) {
    const hrvDelta = ((today.hrvRmssdMs - hrvBaseline) / hrvBaseline) * 100;
    drafts.push({
      key: 'low-recovery',
      category: 'recovery',
      priority: 'high',
      title: 'Low Recovery Today',
      body: `Your readiness is down. HRV is below your recent baseline — consider an easier day and earlier sleep.`,
      detail: `HRV ${today.hrvRmssdMs.toFixed(0)} ms (${hrvDelta >= 0 ? '+' : ''}${hrvDelta.toFixed(0)}% vs baseline)`,
    });
  } else if (today.readiness >= 80) {
    drafts.push({
      key: 'well-recovered',
      category: 'recovery',
      priority: 'normal',
      title: 'Well Recovered',
      body: `Readiness is high and HRV is strong. Your body is primed — a good day to push if you want to.`,
      detail: `Readiness ${today.readiness}/100`,
    });
  }

  // ── vitals: resting HR drift ────────────────────────────────────────────────
  if (hrBaseline > 0 && today.restingHrBpm - hrBaseline >= 3) {
    drafts.push({
      key: 'resting-hr-elevated',
      category: 'vitals',
      priority: 'low',
      title: 'Resting Heart Rate Elevated',
      body: `Your resting heart rate is running above your recent baseline — often a sign of the luteal phase, stress, or the start of illness.`,
      detail: `Resting HR ${today.restingHrBpm.toFixed(0)} bpm (baseline ${hrBaseline.toFixed(0)})`,
    });
  }

  // always give the feed a cycle-day marker as the low-priority anchor
  drafts.push({
    key: 'cycle-day',
    category: 'vitals',
    priority: 'low',
    title: `Cycle Day ${today.cycleDay}`,
    body: `You're on day ${today.cycleDay} of your cycle, in the ${today.phase.toLowerCase()} phase.`,
  });

  return drafts;
};
