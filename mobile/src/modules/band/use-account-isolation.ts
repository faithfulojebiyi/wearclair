import { useEffect } from 'react';

import { disconnectBand } from './band';
import { claimStore, initPersistence } from './local-store';

// account isolation for the local vitals store, driven by the LIVE session — not
// just the explicit sign-out button. Covers the paths performSignOut never sees:
//   - session expiry/revocation: the band stream (bound to the old user id) is
//     stopped so it can't keep filling the queue under a dead identity. The queue
//     itself is kept — the same user signing back in continues offline-tolerant.
//   - account change: claiming the store for the new user wipes anything a
//     previous owner left behind (memory AND the persisted snapshot, via autoSave)
//     before it can be shown or uploaded.
// The claim waits for the persisted snapshot to load, otherwise the previous
// owner's data would overwrite a too-early claim.
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
