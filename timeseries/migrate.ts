// tsdb migration entrypoint — applies the reviewed SQL under migrations/ to
// TSDB_DATABASE_URL. run: bun run tsdb:migrate. recovery semantics live in
// migrate-runner.ts.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Client } from 'pg';

import { runMigrations } from './migrate-runner';

const migrationsDir = join(import.meta.dir, 'migrations');

const url = process.env.TSDB_DATABASE_URL;

if (!url) {
  console.error('TSDB_DATABASE_URL is not set (run via: bun run tsdb:migrate)');
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();

try {
  const names = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const files = await Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(join(migrationsDir, name), 'utf8'),
    })),
  );

  const ran = await runMigrations(client, files);

  console.log(
    ran === 0 ? 'tsdb schema up to date' : `applied ${ran} migration(s)`,
  );
} finally {
  await client.end();
}
