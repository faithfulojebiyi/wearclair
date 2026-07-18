import { useQuery } from '@tanstack/react-query';

import { insightsControllerGetHealth } from '@/api/generated/insights/insights';

// the Insights feed — worker-generated (AI/rule) health cards, newest first.
export const useHealthInsights = (limit = 30) =>
  useQuery({
    queryKey: ['insights', 'health'],
    queryFn: () => insightsControllerGetHealth({ limit }),
  });
