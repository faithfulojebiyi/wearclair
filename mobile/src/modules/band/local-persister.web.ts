import { Store } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';

// web persistence: browser localStorage. Platform-split twin of local-persister.ts.
export const createPlatformPersister = async (store: Store) =>
  createLocalPersister(store, 'wearclair-vitals');
