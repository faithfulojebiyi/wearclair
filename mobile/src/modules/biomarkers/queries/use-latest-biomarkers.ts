import { useQuery } from '@tanstack/react-query';

import { biomarkersControllerGetLatest } from '@/api/generated/biomarkers/biomarkers';

// newest synced reading per metric (fallback when the band isn't streaming locally).
export const useLatestBiomarkers = () =>
  useQuery({
    queryKey: ['biomarkers', 'latest'],
    queryFn: () => biomarkersControllerGetLatest(),
  });
