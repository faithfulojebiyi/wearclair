import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cycleControllerCreateLog } from '@/api/generated/cycle/cycle';
import { CycleLogType } from '@/api/generated/wearclairAPI.schemas';

// append a cycle log for today (the home Quick Actions). invalidates the cycle tree
// so the calendar/timeline pick it up.
export const useCreateLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: { type: string; value: string }) =>
      cycleControllerCreateLog({
        type: action.type as CycleLogType,
        value: action.value,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cycle'] }),
  });
};
