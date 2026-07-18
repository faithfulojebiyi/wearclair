import { Store } from 'tinybase';
import { createExpoSqlitePersister } from 'tinybase/persisters/persister-expo-sqlite';

// native persistence: expo-sqlite. This file is resolved on iOS/Android only —
// the web build resolves local-persister.web.ts instead, so expo-sqlite (and its
// wasm assets) never enter the web bundle.
export const createPlatformPersister = async (store: Store) => {
  const SQLite = await import('expo-sqlite');
  const db = SQLite.openDatabaseSync('wearclair-vitals.db');

  return createExpoSqlitePersister(store, db);
};
