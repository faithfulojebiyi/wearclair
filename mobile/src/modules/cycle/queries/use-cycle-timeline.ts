import { useQuery } from '@tanstack/react-query';

import { cycleControllerGetTimeline } from '@/api/generated/cycle/cycle';

// the Timeline list: period markers + every logged category, newest first.
export const useCycleTimeline = () =>
  useQuery({
    queryKey: ['cycle', 'timeline'],
    queryFn: () => cycleControllerGetTimeline(),
  });
