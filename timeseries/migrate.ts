// tsdb migration runner — applies the reviewed SQL under migrations/ to
// TSDB_DATABASE_URL. run: bun run tsdb:migrate
//
// Deliberately transaction-free: continuous-aggregate DDL (CREATE MATERIALIZED VIEW
// ... WITH (timescaledb.continuous)) refuses to run inside a transaction block, and
// pg's simple-query protocol wraps multi-statement strings in an implicit one — so
// files are split on `-- statement-breakpoint` and each chunk is issued as its own
// query. A file is recorded as applied only after every chunk succeeds; a failed
// file is fixed forward (matching how reviewed tsdb DDL would ship to prod).

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Client } from 'pg';

const migrationsDir = join(import.meta.dir, 'migrations');

const url = process.env.TSDB_DATABASE_URL;

if (!url) {
  console.error('TSDB_DATABASE_URL is not set (run via: bun run tsdb:migrate)');
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();

try {
  await client.query(
    `CREATE TABLE IF NOT EXISTS tsdb_migrations (
       name       text        PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const applied = new Set(
    (
      await client.query<{ name: string }>('SELECT name FROM tsdb_migrations')
    ).rows.map((row) => row.name),
  );

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  let ran = 0;

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), 'utf8');

    const chunks = sql
      .split(/^--\s*statement-breakpoint\s*$/m)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    console.log(`applying ${file} (${chunks.length} statements)`);

    for (const chunk of chunks) {
      await client.query(chunk);
    }

    await client.query('INSERT INTO tsdb_migrations (name) VALUES ($1)', [
      file,
    ]);
    ran += 1;
  }

  console.log(
    ran === 0 ? 'tsdb schema up to date' : `applied ${ran} migration(s)`,
  );
} finally {
  await client.end();
}
