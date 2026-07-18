import { disconnectBand } from '@/modules/band/band';
import { clearAllLocalData } from '@/modules/band/local-store';

import { authClient } from './auth-client';
import { setToken } from './token';

// sign-out clears everything user-scoped on this device: the better-auth session,
// the web bearer token, and the local vitals store (latest readings + unsynced
// queue) — the next account must never see the previous one's health data. The
// band stream stops FIRST: a still-running emit interval (bound to the old user)
// would repopulate the cleared queue within seconds and hand the previous
// account's vitals to the next one.
export const performSignOut = async (): Promise<void> => {
  disconnectBand();

  try {
    await authClient.signOut();
  } finally {
    setToken(null);
    clearAllLocalData();
  }
};
