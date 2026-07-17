-- first-boot init (runs once, on empty volume): the app db (wearclair) is created by
-- POSTGRES_DB; add the mastra + time-series databases. Only wearclair_tsdb loads the
-- timescaledb extension — the Prisma app db stays plain postgres.
CREATE DATABASE wearclair_mastra;
CREATE DATABASE wearclair_tsdb;

\connect wearclair_tsdb
CREATE EXTENSION IF NOT EXISTS timescaledb;
