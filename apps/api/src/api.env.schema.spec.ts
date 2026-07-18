import { describe, expect, it } from 'bun:test';

import { envSchema } from './api.env.schema';

// a fully valid production env — each test removes one key to assert fail-closed
const productionEnv = {
  APP_ENV: 'production',
  NODE_ENV: 'production',
  PORT: 3310,
  API_PREFIX: '/',
  APP_DATABASE_URL: 'postgres://app',
  MASTRA_DATABASE_URL: 'postgres://mastra',
  TSDB_DATABASE_URL: 'postgres://tsdb',
  ANTHROPIC_API_KEY: 'key',
  APP_REDIS_URL: 'redis://cache',
  INNGEST_EVENT_KEY: 'ev',
  INNGEST_SIGNING_KEY: 'sk',
  BETTER_AUTH_SECRET: 'secret',
  BETTER_AUTH_TRUSTED_ORIGINS: 'https://app.example.com',
  RESEND_API_KEY: 'rk',
  AWS_ACCESS_KEY_ID: 'ak',
  AWS_SECRET_ACCESS_KEY: 'as',
  S3_BUCKET: 'bucket',
};

describe('api env schema', () => {
  it('accepts a fully configured production env', () => {
    const { error } = envSchema.validate(productionEnv, { allowUnknown: true });

    expect(error).toBeUndefined();
  });

  it('fails closed in production when BETTER_AUTH_TRUSTED_ORIGINS is missing', () => {
    const { BETTER_AUTH_TRUSTED_ORIGINS: _omitted, ...env } = productionEnv;

    const { error } = envSchema.validate(env, { allowUnknown: true });

    expect(error?.message).toContain('BETTER_AUTH_TRUSTED_ORIGINS');
  });

  it('allows BETTER_AUTH_TRUSTED_ORIGINS to be absent in development', () => {
    const { BETTER_AUTH_TRUSTED_ORIGINS: _omitted, ...env } = productionEnv;

    const { error } = envSchema.validate(
      { ...env, APP_ENV: 'development', NODE_ENV: 'development' },
      { allowUnknown: true },
    );

    expect(error).toBeUndefined();
  });
});
