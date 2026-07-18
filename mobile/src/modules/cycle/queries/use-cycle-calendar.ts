import { useQuery } from '@tanstack/react-query';

import { cycleControllerGetCalendar } from '@/api/generated/cycle/cycle';

// the month/year calendar grid. keySuffix lets callers scope the cache (e.g. the year
// on the hub vs. 'edit' on the Edit-period screen) so they don't collide.
export const useCycleCalendar = (
  range: { from: Date; to: Date },
  keySuffix: string | number,
) =>
  useQuery({
    queryKey: ['cycle', 'calendar', keySuffix],
    queryFn: () =>
      cycleControllerGetCalendar({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      }),
  });
