import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useValue } from 'tinybase/ui-react';

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
  const ownerUserId = useValue('ownerUserId');

  useEffect(() => {
    if (!sessionResolved) {
      return;
    }

    if (!userId) {
      disconnectBand();
      queryClient.clear();

      return;
    }

    let active = true;

    void initPersistence().then(() => {
      if (!active) {
        return;
      }

      if (claimStore(userId)) {
        // the wipe reset `connected` but the emit interval survives — stop it,
        // or it keeps streaming the previous account's vitals into the fresh
        // queue and blocks reconnect
        disconnectBand();
        queryClient.clear();
      }
    });

    return () => {
      active = false;
    };
  }, [userId, sessionResolved, queryClient]);

  return ownerUserId === userId;
};
