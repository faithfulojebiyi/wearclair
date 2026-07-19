import { Pool, QueryResult, QueryResultRow } from 'pg';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

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
  private readonly logger = new Logger(TsdbPool.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.TSDB_DATABASE_URL,
      max: 10,
      options: '-c timezone=UTC',
      // verified TLS outside development — the hosted cert is publicly trusted
      ssl: process.env.NODE_ENV !== 'development' ? true : undefined,
    });

    // pg emits 'error' when an idle client's backend dies — unhandled it kills the process
    this.pool.on('error', (error) => {
      this.logger.error(
        { err: error },
        'idle tsdb client errored — dropped from the pool',
      );
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
