-- device-local calendar day, stamped at ingest from the batch's IANA timezone —
-- reviewed tsdb migration (source of truth). The device is the only component
-- that knows the user's local time; daily stats group by this column so an
-- overnight basal-temp minimum never straddles two UTC buckets.
-- nullable: columnstore hypertables reject ADD COLUMN NOT NULL without a
-- default; every insert stamps it, so rows are never actually null.

ALTER TABLE raw_biomarker ADD COLUMN local_day date;

-- statement-breakpoint

-- read-path index for the daily derivation query (raw grouped by local_day —
-- a continuous aggregate must bucket on ts, so the daily read skips the cagg)
CREATE INDEX raw_biomarker_daily_idx
  ON raw_biomarker (user_id, metric, local_day);
