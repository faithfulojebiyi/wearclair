// typed definitions for the tsdb schema, built with @timescaledb/core (pinned 0.0.1).
// used by generate.ts to emit reference SQL — NEVER executed at runtime. the committed,
// reviewed files under migrations/ are the source of truth; see generate.ts for why.

import { TimescaleDB } from '@timescaledb/core';
import { AggregateType } from '@timescaledb/schemas';

export const RAW_BIOMARKER_TABLE = 'raw_biomarker';

// narrow-table firehose: one row per (user, device, metric, ts) sample. adding a
// biomarker is a new metric value, not a DDL change.
export const rawBiomarkerHypertable = TimescaleDB.createHypertable(
  RAW_BIOMARKER_TABLE,
  {
    by_range: { column_name: 'ts' },
    compression: {
      compress: true,
      compress_segmentby: 'user_id, metric',
      compress_orderby: 'ts DESC',
      policy: { schedule_interval: '7 days' },
    },
  },
);

const rollupAggregates = {
  avg_value: {
    type: AggregateType.Avg,
    column: 'value',
    column_alias: 'avg_value',
  },
  min_value: {
    type: AggregateType.Min,
    column: 'value',
    column_alias: 'min_value',
  },
  max_value: {
    type: AggregateType.Max,
    column: 'value',
    column_alias: 'max_value',
  },
  sample_count: { type: AggregateType.Count, column_alias: 'sample_count' },
};

export const biomarker1h = TimescaleDB.createContinuousAggregate(
  'biomarker_1h',
  RAW_BIOMARKER_TABLE,
  {
    bucket_interval: '1 hour',
    time_column: 'ts',
    group_columns: ['user_id', 'metric'],
    aggregates: rollupAggregates,
    refresh_policy: {
      start_offset: '3 days',
      end_offset: '1 hour',
      schedule_interval: '15 minutes',
    },
  },
);

export const biomarker1d = TimescaleDB.createContinuousAggregate(
  'biomarker_1d',
  RAW_BIOMARKER_TABLE,
  {
    bucket_interval: '1 day',
    time_column: 'ts',
    group_columns: ['user_id', 'metric'],
    aggregates: rollupAggregates,
    refresh_policy: {
      start_offset: '30 days',
      end_offset: '1 day',
      schedule_interval: '1 hour',
    },
  },
);
