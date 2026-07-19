export interface ApiEnvInterface {
  APP_ENV: string;
  NODE_ENV: string;
  PORT: number;
  API_PREFIX?: string;
  TRUST_PROXY?: string;

  // database
  APP_DATABASE_URL: string;
  APP_DATABASE_REPLICA_URL?: string;

  // mastra (agent runtime) — its own database, never Prisma-managed
  MASTRA_DATABASE_URL: string;

  // time-series database (TimescaleDB) — raw pg via BiomarkerStore, never Prisma-managed
  TSDB_DATABASE_URL: string;

  // llm (model router)
  ANTHROPIC_API_KEY?: string;

  // cache
  APP_REDIS_URL?: string;

  // inngest
  INNGEST_DEV?: string;
  INNGEST_EVENT_KEY?: string;
  INNGEST_SIGNING_KEY?: string;

  // better auth
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;

  // resend
  RESEND_API_KEY?: string;

  // storage (S3-compatible: AWS S3 / Tigris / R2 / MinIO)
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  S3_BUCKET?: string;
  S3_ENDPOINT?: string;
  S3_FORCE_PATH_STYLE?: string;

  LOG_LEVEL?: string;
}
