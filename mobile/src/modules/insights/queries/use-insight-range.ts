import { useQuery } from '@tanstack/react-query';

import { insightsControllerGetRange } from '@/api/generated/insights/insights';

const DAY_MS = 24 * 60 * 60 * 1000;

// one 366-day fetch serves every hormone-chart scope; each scope slices client-side.
export const useInsightRange = () =>
  useQuery({
    queryKey: ['insights', 'range'],
    queryFn: () =>
      insightsControllerGetRange({
        from: new Date(Date.now() - 366 * DAY_MS).toISOString(),
        to: new Date(Date.now() + DAY_MS).toISOString(),
      }),
  });
