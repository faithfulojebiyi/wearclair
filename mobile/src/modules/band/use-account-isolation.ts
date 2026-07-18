import { useEffect } from 'react';

import { disconnectBand } from './band';
import { claimStore, initPersistence } from './local-store';

/**
 * live-session isolation for the local vitals store: stops the band stream when
 * the session dies (expiry/revocation) and claims/wipes the store on account
 * change. the claim waits for the persisted snapshot to load.
 */
export const useAccountIsolation = (
  userId: string | undefined,
  sessionResolved: boolean,
): void => {
  useEffect(() => {
    if (!sessionResolved) {
      return;
    }

    if (!userId) {
      disconnectBand();

      return;
    }

    let active = true;

    void initPersistence().then(() => {
      if (active) {
        claimStore(userId);
      }
    });

    return () => {
      active = false;
    };
  }, [userId, sessionResolved]);
};
