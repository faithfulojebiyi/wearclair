import { useQuery } from '@tanstack/react-query';

import { cycleControllerGetPredictions } from '@/api/generated/cycle/cycle';

// next ovulation / period / fertile window, anchored on the user's period model.
export const usePredictions = () =>
  useQuery({
    queryKey: ['cycle', 'predictions'],
    queryFn: () => cycleControllerGetPredictions(),
  });
