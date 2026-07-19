/**
 * tsdb migration core, separated from the pg entrypoint so recovery behavior is
 * unit-testable. statement + progress journal commit atomically in one
 * transaction; DDL that refuses transaction blocks (cagg creates, SQLSTATE
 * 25001) runs outside one, where a crash between the two commits replays the
 * statement — its duplicate error is treated as already-applied.
 */

export interface MigrationClient {
  query<Row = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Row[] }>;
}

export interface MigrationFile {
  name: string;
  sql: string;
}

const errorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;

// 42P07 duplicate table/matview/index, 42710 duplicate object (policies)
const isDuplicate = (error: unknown): boolean =>
  errorCode(error) === '42P07' || errorCode(error) === '42710';

const refusesTransaction = (error: unknown): boolean =>
  errorCode(error) === '25001';

const JOURNAL_SQL = `INSERT INTO tsdb_migration_progress (name, statements, updated_at)
   VALUES ($1, $2, now())
   ON CONFLICT (name) DO UPDATE SET statements = $2, updated_at = now()`;

const applyChunk = async (
  client: MigrationClient,
  file: string,
  chunk: string,
  index: number,
): Promise<void> => {
  // atomic path: DDL + journal in one commit
  try {
    await client.query('BEGIN');
    await client.query(chunk);
    await client.query(JOURNAL_SQL, [file, index + 1]);
    await client.query('COMMIT');

    return;
  } catch (error) {
    await client.query('ROLLBACK');

    if (!refusesTransaction(error)) {
      throw error;
    }
  }

  // transaction-refusing DDL: journal separately; a crash-replay hits its
  // duplicate error — treat as applied
  try {
    await client.query(chunk);
  } catch (error) {
    if (!isDuplicate(error)) {
      throw error;
    }

    console.log(
      `  statement ${index + 1} already exists (crash replay) — continuing`,
    );
  }

  await client.query(JOURNAL_SQL, [file, index + 1]);
};

export const runMigrations = async (
  client: MigrationClient,
  files: MigrationFile[],
): Promise<number> => {
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

  let ran = 0;

  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    if (applied.has(file.name)) {
      continue;
    }

    const chunks = file.sql
      .split(/^--\s*statement-breakpoint\s*$/m)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    const progress = await client.query<{ statements: number }>(
      'SELECT statements FROM tsdb_migration_progress WHERE name = $1',
      [file.name],
    );
    const done = progress.rows[0]?.statements ?? 0;

    console.log(
      done > 0
        ? `resuming ${file.name} at statement ${done + 1}/${chunks.length}`
        : `applying ${file.name} (${chunks.length} statements)`,
    );

    for (let index = done; index < chunks.length; index += 1) {
      await applyChunk(client, file.name, chunks[index], index);
    }

    await client.query('INSERT INTO tsdb_migrations (name) VALUES ($1)', [
      file.name,
    ]);
    await client.query('DELETE FROM tsdb_migration_progress WHERE name = $1', [
      file.name,
    ]);
    ran += 1;
  }

  return ran;
};
