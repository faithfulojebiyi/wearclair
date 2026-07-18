import { CycleDay } from '@/api/generated/wearclairAPI.schemas';

export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// yyyy-mm-dd key in UTC — the app-wide day identity used across the cycle feature
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// a day key → the ISO datetime the API expects (midnight UTC)
export const toIso = (key: string) => new Date(`${key}T00:00:00Z`).toISOString();

// index calendar days by their day key for O(1) cell lookups
export const buildDayMap = (days: CycleDay[]): Map<string, CycleDay> => {
  const map = new Map<string, CycleDay>();

  for (const day of days) {
    map.set(dayKey(new Date(day.date)), day);
  }

  return map;
};

// the Sun..Sat week containing the given day key
export const weekOf = (key: string): Date[] => {
  const base = new Date(`${key}T00:00:00Z`);
  const sunday = new Date(base);
  sunday.setUTCDate(base.getUTCDate() - base.getUTCDay());

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setUTCDate(sunday.getUTCDate() + i);

    return d;
  });
};
