import { describe, expect, it } from 'bun:test';

import { MigrationClient, MigrationFile, runMigrations } from './migrate-runner';

const pgError = (message: string, code: string) =>
  Object.assign(new Error(message), { code });

/**
 * minimal pg stand-in: tracks the journal tables, transaction state, which
 * chunks actually executed, and models cagg DDL (refuses transaction blocks,
 * duplicate error when re-created).
 */
const makeDb = () => {
  const applied: string[] = [];
  const progress = new Map<string, number>();
  const executed: string[] = [];
  const created = new Set<string>();
  const failOnce = new Map<string, Error>();

  let inTx = false;
  let txQueue: (() => void)[] = [];

  const query = async (sql: string, params?: unknown[]) => {
    if (sql === 'BEGIN') {
      inTx = true;
      txQueue = [];

      return { rows: [] };
    }

    if (sql === 'COMMIT') {
      inTx = false;
      txQueue.forEach((apply) => apply());
      txQueue = [];

      return { rows: [] };
    }

    if (sql === 'ROLLBACK') {
      inTx = false;
      txQueue = [];

      return { rows: [] };
    }

    if (sql.startsWith('CREATE TABLE IF NOT EXISTS')) {
      return { rows: [] };
    }

    if (sql.includes('SELECT name FROM tsdb_migrations')) {
      return { rows: applied.map((name) => ({ name })) };
    }

    if (sql.includes('SELECT statements FROM tsdb_migration_progress')) {
      const name = String(params?.[0]);

      return {
        rows: progress.has(name)
          ? [{ statements: progress.get(name) }]
          : [],
      };
    }

    if (sql.includes('INSERT INTO tsdb_migration_progress')) {
      const name = String(params?.[0]);
      const statements = Number(params?.[1]);
      const failure = failOnce.get('journal');

      if (failure) {
        failOnce.delete('journal');
        throw failure;
      }

      const apply = () => progress.set(name, statements);
      inTx ? txQueue.push(apply) : apply();

      return { rows: [] };
    }

    if (sql.includes('INSERT INTO tsdb_migrations')) {
      applied.push(String(params?.[0]));

      return { rows: [] };
    }

    if (sql.includes('DELETE FROM tsdb_migration_progress')) {
      progress.delete(String(params?.[0]));

      return { rows: [] };
    }

    // a migration chunk
    const failure = failOnce.get(sql);

    if (failure) {
      failOnce.delete(sql);
      throw failure;
    }

    const isCagg = sql.includes('timescaledb.continuous');

    if (isCagg && inTx) {
      throw pgError('cannot run inside a transaction block', '25001');
    }

    if (isCagg && created.has(sql)) {
      throw pgError('already exists', '42P07');
    }

    const apply = () => {
      executed.push(sql);
      created.add(sql);
    };
    inTx ? txQueue.push(apply) : apply();

    return { rows: [] };
  };

  return {
    client: { query } as MigrationClient,
    applied,
    progress,
    executed,
    created,
    failOnce,
  };
};

const file = (name: string, ...chunks: string[]): MigrationFile => ({
  name,
  sql: chunks.join('\n-- statement-breakpoint\n'),
});

describe('runMigrations recovery', () => {
  it('applies pending files and is a no-op on rerun', async () => {
    const db = makeDb();
    const files = [file('0001.sql', 'CREATE TABLE a (x int)', 'CREATE INDEX i ON a (x)')];

    expect(await runMigrations(db.client, files)).toBe(1);
    expect(db.executed.length).toBe(2);
    expect(db.applied).toEqual(['0001.sql']);
    expect(db.progress.size).toBe(0);

    expect(await runMigrations(db.client, files)).toBe(0);
    expect(db.executed.length).toBe(2);
  });

  it('resumes at the failed statement, never replaying committed ones', async () => {
    const db = makeDb();
    const files = [file('0001.sql', 'CREATE TABLE a (x int)', 'CREATE BROKEN', 'CREATE TABLE b (x int)')];
    db.failOnce.set('CREATE BROKEN', pgError('syntax error', '42601'));

    await expect(runMigrations(db.client, files)).rejects.toThrow('syntax error');

    // statement 1 committed atomically with its journal entry
    expect(db.progress.get('0001.sql')).toBe(1);
    expect(db.applied).toEqual([]);

    expect(await runMigrations(db.client, files)).toBe(1);
    expect(db.executed).toEqual([
      'CREATE TABLE a (x int)',
      'CREATE BROKEN',
      'CREATE TABLE b (x int)',
    ]);
  });

  it('tolerates the duplicate error when a crash replays non-transactional cagg DDL', async () => {
    const db = makeDb();
    const cagg = `CREATE MATERIALIZED VIEW v WITH (timescaledb.continuous) AS SELECT 1`;
    const files = [file('0002.sql', cagg, 'SELECT add_policy(1)')];

    // crash analog: the cagg committed but its separate journal write did not
    db.failOnce.set('journal', pgError('connection terminated', '57P01'));
    await expect(runMigrations(db.client, files)).rejects.toThrow('connection terminated');
    expect(db.created.has(cagg)).toBe(true);
    expect(db.progress.has('0002.sql')).toBe(false);

    // rerun replays the cagg → duplicate error is treated as applied
    expect(await runMigrations(db.client, files)).toBe(1);
    expect(db.applied).toEqual(['0002.sql']);
    expect(db.progress.size).toBe(0);
  });

  it('commits statement and journal entry atomically for transactional DDL', async () => {
    const db = makeDb();
    // journal write fails inside the transaction → the statement must not persist
    db.failOnce.set('journal', pgError('deadlock', '40P01'));

    await expect(
      runMigrations(db.client, [file('0003.sql', 'CREATE TABLE c (x int)')]),
    ).rejects.toThrow('deadlock');

    expect(db.executed).toEqual([]);
    expect(db.progress.has('0003.sql')).toBe(false);

    expect(await runMigrations(db.client, [file('0003.sql', 'CREATE TABLE c (x int)')])).toBe(1);
    expect(db.executed).toEqual(['CREATE TABLE c (x int)']);
  });
});
