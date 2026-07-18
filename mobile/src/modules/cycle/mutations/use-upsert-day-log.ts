import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cycleControllerUpsertDayLog } from '@/api/generated/cycle/cycle';
import { CycleLogType } from '@/api/generated/wearclairAPI.schemas';

import { toIso } from '../utils';

// upsert one Track category for a day. the open day's local state owns its edits (the
// Track screen guards re-seeding), so invalidating ['cycle'] safely refreshes the
// calendar/timeline/day summaries without clobbering in-progress input.
export const useUpsertDayLog = (dayKeyStr: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { type: string; value: string }) =>
      cycleControllerUpsertDayLog({
        date: toIso(dayKeyStr),
        type: vars.type as CycleLogType,
        value: vars.value,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cycle'] }),
  });
};
