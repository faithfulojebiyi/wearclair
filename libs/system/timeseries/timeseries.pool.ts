import { Pool, QueryResult, QueryResultRow } from 'pg';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

export type TsdbQueryFn = <Row extends QueryResultRow>(
  sql: string,
  params?: unknown[],
) => Promise<QueryResult<Row>>;

// dedicated pg pool for the time-series database (TSDB_DATABASE_URL) — independent
// of the Prisma app-db pool. capped so api (prisma + tsdb) stays well under the
// postgres connection budget. timezone pinned to UTC: time_bucket results are
// rendered/compared in UTC everywhere (and the @timescaledb/core reader formats
// bucket timestamps with a literal 'Z').
@Injectable()
export class TsdbPool implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.TSDB_DATABASE_URL,
      max: 10,
      options: '-c timezone=UTC',
      ssl:
        process.env.NODE_ENV !== 'development'
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }

  query<Row extends QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<Row>> {
    return this.pool.query<Row>(sql, params);
  }

  // all statements issued through `query` run on ONE connection inside a single
  // BEGIN/COMMIT — rolls back as a unit on any failure.
  async withTransaction<T>(fn: (query: TsdbQueryFn) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await fn((sql, params) => client.query(sql, params));

      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');

      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
