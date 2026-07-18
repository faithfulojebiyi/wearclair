import { TimescaleDB } from '@timescaledb/core';

import { Injectable } from '@nestjs/common';

import { TsdbPool } from './timeseries.pool';
import { BiomarkerMetric, SeriesBucket } from './timeseries.schema';

export interface RawSample {
  ts: Date;
  metric: BiomarkerMetric;
  value: number;
}

export interface SeriesPoint {
  bucket: Date;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface DailyStat {
  day: Date;
  metric: BiomarkerMetric;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface LatestReading {
  metric: BiomarkerMetric;
  ts: Date;
  value: number;
}

// bucket -> relation. cagg views come from this hard map keyed by the zod enum —
// identifiers are never built from user input. 5m has no cagg; it reads the raw
// hypertable through the @timescaledb/core time_bucket builder.
const BUCKET_VIEW = { '1h': 'biomarker_1h', '1d': 'biomarker_1d' } as const;

const INSERT_CHUNK = 10_000;

// query builder handle for raw-hypertable reads (SQL generation only — execution
// stays on our pool; the store owns the connection, no ORM in the firehose).
const rawBiomarker = TimescaleDB.createHypertable('raw_biomarker', {
  by_range: { column_name: 'ts' },
});

interface SeriesRow {
  bucket: Date;
  avg_value: number;
  min_value: number;
  max_value: number;
  sample_count: string;
}

// the swappable time-series repository: everything the apps know about the tsdb.
// swapping the backing store (local container -> Tiger Cloud) is a URL change;
// swapping the engine is a reimplementation of this class and nothing else.
@Injectable()
export class BiomarkerStore {
  constructor(private readonly pool: TsdbPool) {}

  // chunked batch insert inside ONE transaction: either every sample lands or none
  // do, so a FAILED batch truly means nothing persisted and a retry re-counts the
  // full batch. the unique index + deterministic generator make re-ingest of any
  // window a no-op (ON CONFLICT DO NOTHING).
  async insertBatch(
    userId: string,
    deviceId: string,
    samples: RawSample[],
  ): Promise<{ inserted: number }> {
    return this.pool.withTransaction(async (query) => {
      let inserted = 0;

      for (let offset = 0; offset < samples.length; offset += INSERT_CHUNK) {
        const chunk = samples.slice(offset, offset + INSERT_CHUNK);

        const result = await query(
          `INSERT INTO raw_biomarker (ts, user_id, device_id, metric, value)
           SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::text[], $4::text[], $5::float8[])
           ON CONFLICT DO NOTHING`,
          [
            chunk.map((sample) => sample.ts.toISOString()),
            chunk.map(() => userId),
            chunk.map(() => deviceId),
            chunk.map((sample) => sample.metric),
            chunk.map((sample) => sample.value),
          ],
        );

        inserted += result.rowCount ?? 0;
      }

      return { inserted };
    });
  }

  async querySeries(args: {
    userId: string;
    metric: BiomarkerMetric;
    bucket: SeriesBucket;
    from: Date;
    to: Date;
  }): Promise<SeriesPoint[]> {
    if (args.bucket === '5m') {
      return this.queryRawBuckets(args);
    }

    const view = BUCKET_VIEW[args.bucket];

    const result = await this.pool.query<SeriesRow>(
      `SELECT bucket, avg_value, min_value, max_value, sample_count::int AS sample_count
       FROM ${view}
       WHERE user_id = $1 AND metric = $2 AND bucket >= $3 AND bucket < $4
       ORDER BY bucket`,
      [
        args.userId,
        args.metric,
        args.from.toISOString(),
        args.to.toISOString(),
      ],
    );

    return result.rows.map((row) => ({
      bucket: row.bucket,
      avg: row.avg_value,
      min: row.min_value,
      max: row.max_value,
      count: Number(row.sample_count),
    }));
  }

  // fine-grained recent reads straight off the hypertable — SQL built by
  // @timescaledb/core's time_bucket builder, executed through our pool.
  private async queryRawBuckets(args: {
    userId: string;
    metric: BiomarkerMetric;
    from: Date;
    to: Date;
  }): Promise<SeriesPoint[]> {
    const { sql, params } = rawBiomarker
      .timeBucket({
        interval: '5 minutes',
        metrics: [
          { type: 'avg', column: 'value', alias: 'avg_value' },
          { type: 'min', column: 'value', alias: 'min_value' },
          { type: 'max', column: 'value', alias: 'max_value' },
          { type: 'count', alias: 'sample_count' },
        ],
      })
      .build({
        range: { start: args.from, end: args.to },
        where: { user_id: args.userId, metric: args.metric },
      });

    const result = await this.pool.query<{
      interval: string;
      avg_value: number;
      min_value: number;
      max_value: number;
      sample_count: string;
    }>(sql, params);

    return result.rows
      .map((row) => ({
        bucket: new Date(row.interval),
        avg: row.avg_value,
        min: row.min_value,
        max: row.max_value,
        count: Number(row.sample_count),
      }))
      .sort((a, b) => a.bucket.getTime() - b.bucket.getTime());
  }

  // durable rows for a batch window — the ground truth the sync ledger reconciles
  // against: a crash between the tsdb commit and the ledger update leaves data
  // here that the app db doesn't know about yet.
  async countWindow(args: {
    userId: string;
    deviceId: string;
    from: Date;
    to: Date;
  }): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT count(*) AS count
       FROM raw_biomarker
       WHERE user_id = $1 AND device_id = $2 AND ts >= $3 AND ts <= $4`,
      [
        args.userId,
        args.deviceId,
        args.from.toISOString(),
        args.to.toISOString(),
      ],
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  async queryDailyStats(args: {
    userId: string;
    metrics: BiomarkerMetric[];
    from: Date;
    to: Date;
  }): Promise<DailyStat[]> {
    const result = await this.pool.query<
      SeriesRow & { metric: BiomarkerMetric }
    >(
      `SELECT bucket, metric, avg_value, min_value, max_value, sample_count::int AS sample_count
       FROM biomarker_1d
       WHERE user_id = $1 AND metric = ANY($2) AND bucket >= $3 AND bucket < $4
       ORDER BY bucket, metric`,
      [
        args.userId,
        args.metrics,
        args.from.toISOString(),
        args.to.toISOString(),
      ],
    );

    return result.rows.map((row) => ({
      day: row.bucket,
      metric: row.metric,
      avg: row.avg_value,
      min: row.min_value,
      max: row.max_value,
      count: Number(row.sample_count),
    }));
  }

  // materialize both rollups up to the start of their current (incomplete) bucket.
  // real-time aggregates only union raw rows at/after the watermark, so samples
  // landing in already-materialized buckets (offline/late syncs) are invisible to
  // aggregate reads until a refresh covers them. the end bound stops at the current
  // bucket start — never in the future — so the live head keeps being served from
  // raw via the real-time union. NULL start closes never-materialized gaps, and the
  // invalidation log makes unchanged regions a no-op, so this is cheap per sync.
  // CALL cannot run inside a transaction — each refresh is its own autocommit query.
  async refreshRollups(): Promise<void> {
    await this.pool.query(
      `CALL refresh_continuous_aggregate('biomarker_1h', NULL, time_bucket('1 hour', now()))`,
    );
    await this.pool.query(
      `CALL refresh_continuous_aggregate('biomarker_1d', NULL, time_bucket('1 day', now()))`,
    );
  }

  // liveness probe for health checks.
  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  // per-metric latest reading — DISTINCT ON rides the (user_id, metric, ts) index.
  async latest(userId: string): Promise<LatestReading[]> {
    const result = await this.pool.query<{
      metric: BiomarkerMetric;
      ts: Date;
      value: number;
    }>(
      `SELECT DISTINCT ON (metric) metric, ts, value
       FROM raw_biomarker
       WHERE user_id = $1
       ORDER BY metric, ts DESC`,
      [userId],
    );

    return result.rows;
  }
}
