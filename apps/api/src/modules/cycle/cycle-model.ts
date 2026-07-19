import { CyclePhase } from '@feature/cycle-insights/phase';

// shared cycle math. the user's logged period days are authoritative: when they exist
// we derive the cycle length + anchor from them and recompute every future day off
// that model, so editing the period shifts all predictions. with no period logs we
// fall back to the worker-derived DailyInsight (28-day) behaviour.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;
// fallback (no period logs) window constants — day-of-cycle based
export const OVULATION_DAY = 14;
export const FERTILE_START = 10;
export const FERTILE_END = 15;

/**
 * CycleLog.value tombstone for type 'period': the user explicitly unmarked the
 * day, which must override the worker's MENSTRUAL classification. a bare delete
 * cannot — absence is indistinguishable from "never logged".
 */
export const PERIOD_EXCLUDED = 'excluded';

export const dayKey = (date: Date) => date.toISOString().slice(0, 10);

// today's calendar day in the user's timezone ('en-CA' renders YYYY-MM-DD);
// missing/invalid zones fall back to UTC
export const todayKeyIn = (timezone: string | null | undefined): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone ?? 'UTC',
    }).format(new Date());
  } catch {
    return dayKey(new Date());
  }
};

// midnight-UTC start of the given date (matches how @db.Date rows come back)
export const startOfDay = (date: Date) => new Date(dayKey(date));

const median = (nums: number[]): number | null => {
  if (nums.length === 0) {
    return null;
  }

  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export interface PeriodModel {
  anchor: Date; // most recent period start
  length: number; // derived cycle length (median gap between starts)
  periodLength: number; // derived typical bleed length
  ovulationDay: number; // length - 14, clamped
}

// derive (anchor, cycle length, period length) from the user's logged period days.
// returns null when there are no period logs to anchor on.
export const buildPeriodModel = (periodDates: Date[]): PeriodModel | null => {
  if (periodDates.length === 0) {
    return null;
  }

  // unique day keys, ascending
  const days = [...new Set(periodDates.map(dayKey))].sort();

  // group contiguous days into period runs
  const runs: string[][] = [];

  for (const key of days) {
    const last = runs[runs.length - 1];
    const prevKey = last?.[last.length - 1];
    const contiguous =
      prevKey !== undefined &&
      Math.round(
        (new Date(key).getTime() - new Date(prevKey).getTime()) / DAY_MS,
      ) === 1;

    if (contiguous) {
      last.push(key);
    } else {
      runs.push([key]);
    }
  }

  const starts = runs.map((run) => new Date(run[0]));

  const gaps: number[] = [];

  for (let i = 1; i < starts.length; i += 1) {
    gaps.push(
      Math.round((starts[i].getTime() - starts[i - 1].getTime()) / DAY_MS),
    );
  }

  // ignore implausible gaps (double-logged spotting, missed cycles) before the median
  const length =
    median(gaps.filter((gap) => gap >= 15 && gap <= 60)) ??
    DEFAULT_CYCLE_LENGTH;
  const periodLength =
    median(runs.map((run) => run.length)) ?? DEFAULT_PERIOD_LENGTH;
  const anchor = starts[starts.length - 1];
  const ovulationDay = Math.max(1, length - 14);

  return { anchor, length, periodLength, ovulationDay };
};

// cycle day (1-based) for any date, projected from the model anchor
export const projectCycleDay = (model: PeriodModel, date: Date): number => {
  const offset = Math.round((date.getTime() - model.anchor.getTime()) / DAY_MS);

  return (((offset % model.length) + model.length) % model.length) + 1;
};

export const phaseForDay = (
  model: PeriodModel,
  cycleDay: number,
): CyclePhase => {
  if (cycleDay <= model.periodLength) {
    return CyclePhase.MENSTRUAL;
  }

  if (Math.abs(cycleDay - model.ovulationDay) <= 1) {
    return CyclePhase.OVULATORY;
  }

  return cycleDay < model.ovulationDay
    ? CyclePhase.FOLLICULAR
    : CyclePhase.LUTEAL;
};

interface ProjectedDay {
  cycleDay: number;
  isPeriod: boolean;
  isFertile: boolean;
  isOvulation: boolean;
}

// projected period/fertile/ovulation flags for a date, from the model
export const projectDay = (model: PeriodModel, date: Date): ProjectedDay => {
  const cycleDay = projectCycleDay(model, date);
  const fertileStart = model.ovulationDay - 5;

  return {
    cycleDay,
    isPeriod: cycleDay <= model.periodLength,
    isFertile: cycleDay >= fertileStart && cycleDay <= model.ovulationDay,
    isOvulation: cycleDay === model.ovulationDay,
  };
};

export interface CalendarDayState {
  cycleDay: number | null;
  phase: CyclePhase | null;
  isPeriod: boolean;
  isFertile: boolean;
  isOvulation: boolean;
  isPredicted: boolean;
}

interface DeriveDayInputs {
  date: Date;
  todayKey: string;
  insight: { cycleDay: number; phase: CyclePhase } | null;
  isLoggedPeriod: boolean;
  isExcludedPeriod: boolean; // user tombstone — overrides every period source
  model: PeriodModel | null;
  fallbackCycleDay: number | null; // latest-insight projection when there's no model
}

// single source of truth for a calendar cell's state, shared by the calendar grid
// and the single-day summary. past days with real data stay authoritative; future
// (and gaps) recompute from the user's period model, else the 28-day fallback.
export const deriveCalendarDay = (inp: DeriveDayInputs): CalendarDayState => {
  const key = dayKey(inp.date);
  const isPredicted = key > inp.todayKey;
  const phase = inp.insight?.phase ?? null;

  // past/today with real derived data — authoritative
  if (!isPredicted && inp.insight) {
    const cycleDay = inp.insight.cycleDay;

    return {
      cycleDay,
      phase,
      isPeriod:
        !inp.isExcludedPeriod &&
        (phase === CyclePhase.MENSTRUAL ||
          inp.isLoggedPeriod ||
          (phase === null && cycleDay <= 5)),
      isFertile: cycleDay >= FERTILE_START && cycleDay <= FERTILE_END,
      isOvulation: cycleDay === OVULATION_DAY,
      isPredicted,
    };
  }

  // future (or a gap) projected from the user's logged period
  if (inp.model) {
    const proj = projectDay(inp.model, inp.date);

    return {
      cycleDay: proj.cycleDay,
      phase,
      isPeriod: !inp.isExcludedPeriod && (proj.isPeriod || inp.isLoggedPeriod),
      isFertile: proj.isFertile,
      isOvulation: proj.isOvulation,
      isPredicted,
    };
  }

  // no period logs: fall back to the latest-insight 28-day projection
  const cycleDay = inp.insight?.cycleDay ?? inp.fallbackCycleDay;

  return {
    cycleDay,
    phase,
    isPeriod:
      !inp.isExcludedPeriod &&
      (phase === CyclePhase.MENSTRUAL ||
        inp.isLoggedPeriod ||
        (phase === null && cycleDay !== null && cycleDay <= 5)),
    isFertile:
      cycleDay !== null && cycleDay >= FERTILE_START && cycleDay <= FERTILE_END,
    isOvulation: cycleDay === OVULATION_DAY,
    isPredicted,
  };
};

export const fertilityChance = (state: CalendarDayState): string => {
  if (state.isOvulation) {
    return 'High';
  }

  if (state.isFertile) {
    return 'Medium';
  }

  return 'Low';
};
