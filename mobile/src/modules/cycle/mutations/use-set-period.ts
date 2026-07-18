import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cycleControllerSetPeriod } from '@/api/generated/cycle/cycle';

// Edit-period SAVE. invalidating the whole ['cycle'] tree recalculates the calendar,
// day summaries, timeline, and predictions from the new period model.
export const useSetPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { from: string; to: string; dates: string[] }) =>
      cycleControllerSetPeriod(vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cycle'] }),
  });
};
