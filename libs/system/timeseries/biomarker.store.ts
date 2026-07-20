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

  /**
   * chunked batch insert inside ONE transaction: either every sample lands or
   * none do, so a FAILED batch truly means nothing persisted and a retry
   * re-counts the full batch. the unique index + deterministic generator make
   * re-ingest of any window a no-op (ON CONFLICT DO NOTHING). local_day is the
   * device-local calendar day, stamped from the batch's IANA timezone.
   */
  async insertBatch(
    userId: string,
    deviceId: string,
    samples: RawSample[],
    batchId?: string,
    timezone = 'UTC',
  ): Promise<{ inserted: number }> {
    return this.pool.withTransaction(async (query) => {
      let inserted = 0;

      for (let offset = 0; offset < samples.length; offset += INSERT_CHUNK) {
        const chunk = samples.slice(offset, offset + INSERT_CHUNK);

        const result = await query(
          `INSERT INTO raw_biomarker (ts, user_id, device_id, metric, value, batch_id, local_day)
           SELECT u.ts, u.user_id, u.device_id, u.metric, u.value, u.batch_id, (u.ts AT TIME ZONE $7)::date
           FROM unnest($1::timestamptz[], $2::text[], $3::text[], $4::text[], $5::float8[], $6::text[])
             AS u(ts, user_id, device_id, metric, value, batch_id)
           ON CONFLICT DO NOTHING`,
          [
            chunk.map((sample) => sample.ts.toISOString()),
            chunk.map(() => userId),
            chunk.map(() => deviceId),
            chunk.map((sample) => sample.metric),
            chunk.map((sample) => sample.value),
            chunk.map(() => batchId ?? null),
            timezone,
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

  // durable rows attributed to a batch — overlapping older data must not count
  async countBatchRows(args: {
    userId: string;
    deviceId: string;
    batchId: string;
    from: Date;
    to: Date;
  }): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT count(*) AS count
       FROM raw_biomarker
       WHERE user_id = $1 AND device_id = $2 AND batch_id = $3
         AND ts >= $4 AND ts <= $5`,
      [
        args.userId,
        args.deviceId,
        args.batchId,
        args.from.toISOString(),
        args.to.toISOString(),
      ],
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  /**
   * per-(local_day, metric) stats straight off the raw hypertable — a cagg
   * must bucket on ts (UTC), so device-local days group raw rows instead,
   * riding the (user_id, metric, local_day) index. day::text avoids the pg
   * date parser's local-midnight Dates; days stay UTC-midnight like before.
   */
  async queryDailyStats(args: {
    userId: string;
    metrics: BiomarkerMetric[];
    from: Date;
    to: Date;
  }): Promise<DailyStat[]> {
    const result = await this.pool.query<{
      day: string;
      metric: BiomarkerMetric;
      avg_value: number;
      min_value: number;
      max_value: number;
      sample_count: string;
    }>(
      `SELECT local_day::text AS day, metric,
              avg(value) AS avg_value, min(value) AS min_value, max(value) AS max_value,
              count(*)::int AS sample_count
       FROM raw_biomarker
       WHERE user_id = $1 AND metric = ANY($2) AND local_day >= $3::date AND local_day < $4::date
       GROUP BY local_day, metric
       ORDER BY local_day, metric`,
      [
        args.userId,
        args.metrics,
        args.from.toISOString(),
        args.to.toISOString(),
      ],
    );

    return result.rows.map((row) => ({
      day: new Date(`${row.day}T00:00:00.000Z`),
      metric: row.metric,
      avg: row.avg_value,
      min: row.min_value,
      max: row.max_value,
      count: Number(row.sample_count),
    }));
  }

  /**
   * bulk seeding materializes chart history immediately. Live classification reads
   * raw local-day rows and never invokes this full-history refresh.
   */
  async refreshChartRollups(): Promise<void> {
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
