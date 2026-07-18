// calendar-aligned hormone series builder for the home chart. ALWAYS truncated at
// "now" — nothing in the future is drawn, but the axis spans the full period so the
// untraveled remainder reads as empty. All values are real backend-derived insights
// (carry-forward for any gap; never projected). day = 12am→current hour, week = Sun→
// today, month = 1→today, year = Jan→current month.

const DAY_MS = 24 * 60 * 60 * 1000;

export type Scope = 'day' | 'week' | 'month' | 'year';

export const SCOPES: { key: Scope; label: string }[] = [
  { key: 'day', label: 'D' },
  { key: 'week', label: 'W' },
  { key: 'month', label: 'M' },
  { key: 'year', label: 'Y' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface ChartPoint {
  value: number;
}

export interface AxisTick {
  slot: number;
  label: string;
}

export interface Hormones {
  estradiolPgMl: number;
  progesteroneNgMl: number;
  lhMiuMl: number;
  fshMiuMl: number;
}

export interface HormoneChart {
  est: ChartPoint[];
  prog: ChartPoint[];
  lh: ChartPoint[];
  fsh: ChartPoint[];
  // x-axis always spans the WHOLE period; series stop at "now"
  axis: AxisTick[];
  slots: number;
}

// all four series ride one chart, each scaled onto the estradiol axis (pg/mL, ~0-320)
const SERIES_SCALE = { est: 1, prog: 20, lh: 4, fsh: 8 } as const;

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const mixHormones = (a: Hormones, b: Hormones, t: number): Hormones => ({
  estradiolPgMl: a.estradiolPgMl * (1 - t) + b.estradiolPgMl * t,
  progesteroneNgMl: a.progesteroneNgMl * (1 - t) + b.progesteroneNgMl * t,
  lhMiuMl: a.lhMiuMl * (1 - t) + b.lhMiuMl * t,
  fshMiuMl: a.fshMiuMl * (1 - t) + b.fshMiuMl * t,
});

const avgHormones = (list: Hormones[]): Hormones => ({
  estradiolPgMl: list.reduce((s, h) => s + h.estradiolPgMl, 0) / list.length,
  progesteroneNgMl: list.reduce((s, h) => s + h.progesteroneNgMl, 0) / list.length,
  lhMiuMl: list.reduce((s, h) => s + h.lhMiuMl, 0) / list.length,
  fshMiuMl: list.reduce((s, h) => s + h.fshMiuMl, 0) / list.length,
});

export const buildHormoneChart = (
  insights: { date: string; hormones: Hormones }[],
  scope: Scope,
): HormoneChart => {
  const sorted = [...insights]
    .map((day) => ({ date: new Date(day.date), h: day.hormones }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const byDate = new Map(sorted.map((day) => [dayKey(day.date), day.h]));

  // value known AT OR BEFORE `date` (carry-forward) — never reaches into the future
  const knownAt = (date: Date): Hormones => {
    const exact = byDate.get(dayKey(date));

    if (exact) {
      return exact;
    }

    let last = sorted[0]?.h;

    for (const day of sorted) {
      if (day.date.getTime() <= date.getTime()) {
        last = day.h;
      } else {
        break;
      }
    }

    return last ?? { estradiolPgMl: 0, progesteroneNgMl: 0, lhMiuMl: 0, fshMiuMl: 0 };
  };

  const est: ChartPoint[] = [];
  const prog: ChartPoint[] = [];
  const lh: ChartPoint[] = [];
  const fsh: ChartPoint[] = [];

  const point = (h: Hormones) => {
    est.push({ value: h.estradiolPgMl * SERIES_SCALE.est });
    prog.push({ value: h.progesteroneNgMl * SERIES_SCALE.prog });
    lh.push({ value: h.lhMiuMl * SERIES_SCALE.lh });
    fsh.push({ value: h.fshMiuMl * SERIES_SCALE.fsh });
  };

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (scope === 'day') {
    // today from midnight up to the current hour; interpolate yesterday → today
    const today = knownAt(todayUtc);
    const yesterday = knownAt(new Date(todayUtc.getTime() - DAY_MS));
    const currentHour = Math.max(1, now.getUTCHours());

    for (let hour = 0; hour <= currentHour; hour += 1) {
      point(mixHormones(yesterday, today, hour / 24));
    }

    const axis = [0, 3, 6, 9, 12, 15, 18, 21, 24].map((hour) => ({
      slot: hour,
      label: `${String(hour).padStart(2, '0')}:00`,
    }));

    return { est, prog, lh, fsh, axis, slots: 25 };
  }

  if (scope === 'week') {
    const sunday = new Date(todayUtc.getTime() - todayUtc.getUTCDay() * DAY_MS);

    for (let i = 0; i <= todayUtc.getUTCDay(); i += 1) {
      point(knownAt(new Date(sunday.getTime() + i * DAY_MS)));
    }

    const axis = WEEKDAYS.map((label, slot) => ({ slot, label }));

    return { est, prog, lh, fsh, axis, slots: 7 };
  }

  if (scope === 'month') {
    const monthStart = Date.UTC(
      todayUtc.getUTCFullYear(),
      todayUtc.getUTCMonth(),
      1,
    );
    const today = todayUtc.getUTCDate();
    const lastDay = new Date(
      Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() + 1, 0),
    ).getUTCDate();

    for (let d = 1; d <= today; d += 1) {
      point(knownAt(new Date(monthStart + (d - 1) * DAY_MS)));
    }

    const axis: AxisTick[] = [{ slot: 0, label: '1' }];

    for (let d = 5; d <= lastDay; d += 5) {
      axis.push({ slot: d - 1, label: String(d) });
    }

    // always label the month's final day, dropping a multiple-of-5 tick that crowds it
    if (axis[axis.length - 1].slot !== lastDay - 1) {
      if (lastDay - 1 - axis[axis.length - 1].slot < 3) {
        axis.pop();
      }

      axis.push({ slot: lastDay - 1, label: String(lastDay) });
    }

    return { est, prog, lh, fsh, axis, slots: lastDay };
  }

  // year: Jan → current month, monthly averages of real data
  const year = todayUtc.getUTCFullYear();

  for (let m = 0; m <= todayUtc.getUTCMonth(); m += 1) {
    const actual: Hormones[] = [];

    for (const day of sorted) {
      if (day.date.getUTCFullYear() === year && day.date.getUTCMonth() === m) {
        actual.push(day.h);
      }
    }

    point(
      actual.length > 0
        ? avgHormones(actual)
        : knownAt(new Date(Date.UTC(year, m, 15))),
    );
  }

  const axis = MONTHS.map((label, slot) => ({ slot, label }));

  return { est, prog, lh, fsh, axis, slots: 12 };
};
