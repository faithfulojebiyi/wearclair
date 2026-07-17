-- columnstore + (future) retention — reviewed tsdb migration (source of truth).
-- Origin: @timescaledb/core emitted the legacy compression API with a quoting bug
-- (double-quoted option values — postgres reads those as identifiers); reviewed and
-- rewritten against the current columnstore API (TimescaleDB >= 2.18 naming for the
-- same mechanism). Segmenting by (user_id, metric) keeps each user's per-metric
-- stream contiguous — the shape both compression and the read path want.

ALTER TABLE raw_biomarker SET (
  timescaledb.enable_columnstore = true,
  timescaledb.segmentby = 'user_id, metric',
  timescaledb.orderby = 'ts DESC'
);

-- statement-breakpoint

-- WITH (tsdb.hypertable) auto-attached a default columnstore policy at CREATE time;
-- replace it with an explicit 7-day hot window so the raw tier's behavior is stated
-- in reviewed SQL, not an engine default.
CALL remove_columnstore_policy('raw_biomarker', if_exists => true);

-- statement-breakpoint

CALL add_columnstore_policy('raw_biomarker', after => INTERVAL '7 days');

-- retention: deliberately NOT enabled. Raw outlives its hot window only as far as the
-- data budget allows; rollups (biomarker_1h/1d) outlive raw. Enable when the budget
-- is set — @timescaledb/core doesn't support add_retention_policy, so this line stays
-- hand-written either way:
-- SELECT add_retention_policy('raw_biomarker', INTERVAL '365 days');
