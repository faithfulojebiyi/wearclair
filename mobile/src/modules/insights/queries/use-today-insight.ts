import { useQuery } from '@tanstack/react-query';

import { insightsControllerGetToday } from '@/api/generated/insights/insights';

// the most recent derived day (drives the home readiness gauge + phase card).
export const useTodayInsight = () =>
  useQuery({
    queryKey: ['insights', 'today'],
    queryFn: () => insightsControllerGetToday(),
  });
