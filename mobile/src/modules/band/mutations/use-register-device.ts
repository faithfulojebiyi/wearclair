import { useMutation, useQueryClient } from '@tanstack/react-query';

import { devicesControllerRegisterDevice } from '@/api/generated/devices/devices';

// pair a new Clair Band, then refresh the device list.
export const useRegisterDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => devicesControllerRegisterDevice({ name: 'Clair Band' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });
};
