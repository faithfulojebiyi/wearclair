import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { disconnectBand } from './band';
import { claimStore, initPersistence } from './local-store';

/**
 * live-session isolation for the local vitals store AND the react-query cache:
 * stops the band stream + drops cached server data when the session dies
 * (expiry/revocation), claims/wipes both on account change. the claim waits for
 * the persisted snapshot to load. returns true once the current user's claim
 * settled — gate user-scoped rendering on it.
 */
export const useAccountIsolation = (
  userId: string | undefined,
  sessionResolved: boolean,
): boolean => {
  const queryClient = useQueryClient();
  const [claimedFor, setClaimedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionResolved) {
      return;
    }

    if (!userId) {
      disconnectBand();
      queryClient.clear();
      setClaimedFor(null);

      return;
    }

    let active = true;

    void initPersistence().then(() => {
      if (!active) {
        return;
      }

      if (claimStore(userId)) {
        queryClient.clear();
      }

      setClaimedFor(userId);
    });

    return () => {
      active = false;
    };
  }, [userId, sessionResolved, queryClient]);

  return claimedFor === userId;
};
