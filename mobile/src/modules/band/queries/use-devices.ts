import { useQuery } from '@tanstack/react-query';

import { devicesControllerListDevices } from '@/api/generated/devices/devices';

// the user's paired bands (first one drives sync + the profile card). `enabled` lets
// the tabs layout defer the fetch until the session is present.
export const useDevices = (enabled = true) =>
  useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesControllerListDevices(),
    enabled,
  });
