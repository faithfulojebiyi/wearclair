import { useQuery } from '@tanstack/react-query';

import { cycleControllerGetDay } from '@/api/generated/cycle/cycle';

import { toIso } from '../utils';

// a single day's derived state + its logs (fertility summary, Track prefill).
export const useCycleDay = (dayKeyStr: string) =>
  useQuery({
    queryKey: ['cycle', 'day', dayKeyStr],
    queryFn: () => cycleControllerGetDay({ date: toIso(dayKeyStr) }),
  });
