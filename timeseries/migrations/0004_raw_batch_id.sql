-- batch attribution: crash recovery must count THIS batch's rows, not window
-- lookalikes from overlapping older data. null on legacy/seed rows.

ALTER TABLE raw_biomarker ADD COLUMN batch_id text;
