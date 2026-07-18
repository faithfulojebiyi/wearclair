import { clearAllLocalData } from '@/modules/band/local-store';

import { authClient } from './auth-client';
import { setToken } from './token';

// sign-out clears everything user-scoped on this device: the better-auth session,
// the web bearer token, and the local vitals store (latest readings + unsynced
// queue) — the next account must never see the previous one's health data.
export const performSignOut = async (): Promise<void> => {
  try {
    await authClient.signOut();
  } finally {
    setToken(null);
    clearAllLocalData();
  }
};
