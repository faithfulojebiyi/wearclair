// full tsdb wipe: caggs, raw firehose, migration journal. reapply with tsdb:migrate.

import { Client } from 'pg';

const url = process.env.TSDB_DATABASE_URL;

if (!url) {
  console.error('TSDB_DATABASE_URL is not set (run via: bun run tsdb:reset)');
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
