import { Store } from 'tinybase';
import { createSessionPersister } from 'tinybase/persisters/persister-browser';

// web persistence: sessionStorage — raw vitals are health data and don't belong in
// durable browser storage; the queue survives reloads within the tab and is dropped
// when it closes (the backend is the durable store). Platform-split twin of
// local-persister.ts.
const LEGACY_LOCAL_KEY = 'wearclair-vitals';

export const createPlatformPersister = async (store: Store) => {
  // one-time cleanup of vitals persisted to localStorage by earlier builds
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_LOCAL_KEY);
  }

  return createSessionPersister(store, 'wearclair-vitals');
};
