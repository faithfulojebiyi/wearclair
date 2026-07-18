import { disconnectBand } from '@/modules/band/band';
import { clearAllLocalData } from '@/modules/band/local-store';

import { authClient } from './auth-client';
import { setToken } from './token';

/**
 * sign-out clears everything user-scoped: session, web bearer token, local vitals
 * store. the band stream stops FIRST — a live emit interval (bound to the old
 * user) would repopulate the cleared queue within seconds.
 */
export const performSignOut = async (): Promise<void> => {
  disconnectBand();

  try {
    await authClient.signOut();
  } finally {
    setToken(null);
    clearAllLocalData();
  }
};
