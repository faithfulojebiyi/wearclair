// full tsdb wipe: caggs, raw firehose, migration journal. reapply with tsdb:migrate.

import { Client } from 'pg';

const url = process.env.TSDB_DATABASE_URL;

if (!url) {
  console.error('TSDB_DATABASE_URL is not set (run via: bun run tsdb:reset)');
  process.exit(1);
}

/**
 * destructive: drops all raw health data. local development only — refuse
 * production and any non-local host unless TSDB_RESET_FORCE=1 is set explicitly.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const { hostname } = new URL(url);
const forced = process.env.TSDB_RESET_FORCE === '1';

if (process.env.NODE_ENV === 'production' && !forced) {
  console.error('refusing tsdb reset: NODE_ENV=production (set TSDB_RESET_FORCE=1 to override)');
  process.exit(1);
}

if (!LOCAL_HOSTS.has(hostname) && !forced) {
  console.error(`refusing tsdb reset: non-local host "${hostname}" (set TSDB_RESET_FORCE=1 to override)`);
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();

try {
  await client.query('DROP MATERIALIZED VIEW IF EXISTS biomarker_1h CASCADE');
  await client.query('DROP MATERIALIZED VIEW IF EXISTS biomarker_1d CASCADE');
  await client.query('DROP TABLE IF EXISTS raw_biomarker CASCADE');
  await client.query('DROP TABLE IF EXISTS tsdb_migrations');
  await client.query('DROP TABLE IF EXISTS tsdb_migration_progress');

  console.log('tsdb reset');
} finally {
  await client.end();
}
