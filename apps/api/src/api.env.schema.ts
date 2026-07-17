import * as Joi from 'joi';

import {
  OPTIONAL_STRING_IN_DEV_SCHEMA,
  REQUIRED_STRING_SCHEMA,
} from '@system/env/env.schema';

import { ApiEnvInterface } from './api.env.type';

export const envSchema: Joi.ObjectSchema<ApiEnvInterface> = Joi.object({
  APP_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .required(),
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .required(),
  PORT: Joi.number().required(),
  API_PREFIX: OPTIONAL_STRING_IN_DEV_SCHEMA,

  // database
  APP_DATABASE_URL: REQUIRED_STRING_SCHEMA,
  APP_DATABASE_REPLICA_URL: Joi.string().optional(),

  // mastra (agent runtime) — its own database, never Prisma-managed
  MASTRA_DATABASE_URL: REQUIRED_STRING_SCHEMA,

  // time-series database (TimescaleDB) — raw pg via BiomarkerStore, never Prisma-managed
  TSDB_DATABASE_URL: REQUIRED_STRING_SCHEMA,

  // llm (model router) — needed for agent calls
  ANTHROPIC_API_KEY: OPTIONAL_STRING_IN_DEV_SCHEMA,

  // cache
  APP_REDIS_URL: OPTIONAL_STRING_IN_DEV_SCHEMA,

  // inngest — INNGEST_DEV=1 runs the SDK against the local dev server
  INNGEST_DEV: Joi.string().optional(),
  INNGEST_EVENT_KEY: OPTIONAL_STRING_IN_DEV_SCHEMA,
  INNGEST_SIGNING_KEY: OPTIONAL_STRING_IN_DEV_SCHEMA,

  // better auth (required in staging/prod; optional in dev)
  BETTER_AUTH_SECRET: OPTIONAL_STRING_IN_DEV_SCHEMA,
  BETTER_AUTH_URL: Joi.string().optional(),
  BETTER_AUTH_TRUSTED_ORIGINS: Joi.string().optional(),

  // resend
  RESEND_API_KEY: OPTIONAL_STRING_IN_DEV_SCHEMA,

  // storage (S3-compatible: AWS S3 / Tigris / R2 / MinIO)
  AWS_ACCESS_KEY_ID: OPTIONAL_STRING_IN_DEV_SCHEMA,
  AWS_SECRET_ACCESS_KEY: OPTIONAL_STRING_IN_DEV_SCHEMA,
  AWS_REGION: Joi.string().optional(),
  S3_BUCKET: OPTIONAL_STRING_IN_DEV_SCHEMA,
  S3_ENDPOINT: Joi.string().optional(),
  S3_FORCE_PATH_STYLE: Joi.string().optional(),

  LOG_LEVEL: Joi.string().optional(),
});
