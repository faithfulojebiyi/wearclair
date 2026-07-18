/**
 * tsdb migration runner — applies the reviewed SQL under migrations/ to
 * TSDB_DATABASE_URL. run: bun run tsdb:migrate
 *
 * transaction-free (cagg DDL refuses transaction blocks), so files are split on
 * `-- statement-breakpoint` and issued chunk by chunk. per-chunk progress is
 * journaled so a mid-file failure resumes at the failed statement (fix forward).
 */

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

  // in-flight files: committed chunk count, skipped on rerun; cleared on completion
  await client.query(
    `CREATE TABLE IF NOT EXISTS tsdb_migration_progress (
       name       text        PRIMARY KEY,
       statements int         NOT NULL DEFAULT 0,
       updated_at timestamptz NOT NULL DEFAULT now()
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

    const progress = await client.query<{ statements: number }>(
      'SELECT statements FROM tsdb_migration_progress WHERE name = $1',
      [file],
    );
    const done = progress.rows[0]?.statements ?? 0;

    console.log(
      done > 0
        ? `resuming ${file} at statement ${done + 1}/${chunks.length}`
        : `applying ${file} (${chunks.length} statements)`,
    );

    for (let index = done; index < chunks.length; index += 1) {
      await client.query(chunks[index]);

      await client.query(
        `INSERT INTO tsdb_migration_progress (name, statements, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (name) DO UPDATE SET statements = $2, updated_at = now()`,
        [file, index + 1],
      );
    }

    await client.query('INSERT INTO tsdb_migrations (name) VALUES ($1)', [
      file,
    ]);
    await client.query('DELETE FROM tsdb_migration_progress WHERE name = $1', [
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
