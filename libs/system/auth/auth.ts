// Better Auth server instance — the identity layer (consumer product: plain user
// sessions, no organizations/teams). Better Auth owns its own tables (generated via
// `@better-auth/cli generate` into prisma/app/schema.prisma); our domain rows
// reference `user` by id.
//
// Secret / baseURL / trusted origins come from env (BETTER_AUTH_SECRET,
// BETTER_AUTH_URL, BETTER_AUTH_TRUSTED_ORIGINS).

import { expo } from '@better-auth/expo';
import { PrismaPg } from '@prisma/adapter-pg';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';

import { PrismaClient } from '@orm/app';

// dedicated client for the auth layer (shares the same Postgres via the pg adapter).
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.APP_DATABASE_URL,
    ssl:
      process.env.NODE_ENV !== 'development'
        ? { rejectUnauthorized: false }
        : undefined,
  }),
});

// CSRF: state-changing POSTs require a trusted Origin. List the app/frontend origins
// in BETTER_AUTH_TRUSTED_ORIGINS (comma-separated), e.g. the dashboard + api hosts.
const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  appName: 'wearclair',
  baseURL: process.env.BETTER_AUTH_URL, // canonical origin (removes the "Base URL not set" warning)
  ...(trustedOrigins.length ? { trustedOrigins } : {}),
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  // brute-force protection on the auth surface. In-memory counters — fine for a
  // single api instance; move to redis-backed storage when the api scales out
  // (tracked in docs/followups). Only active outside development.
  rateLimit: {
    enabled: process.env.NODE_ENV !== 'development',
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
      '/forget-password': { window: 300, max: 3 },
    },
  },
  advanced: {
    // HTTPS-only session cookies outside development (the api sits behind TLS in prod).
    useSecureCookies: process.env.NODE_ENV !== 'development',
  },
  // expo(): mobile clients persist the session cookie client-side + CSRF for the
  //   wearclair:// scheme + expo dev URLs (see BETTER_AUTH_TRUSTED_ORIGINS).
  // bearer(): lets getSession() accept `Authorization: Bearer <token>`. Browsers
  //   forbid setting the Cookie header from JS, so the web build authenticates via
  //   Bearer; native still uses the cookie header. Both flow through one guard.
  plugins: [expo(), bearer()],
});

export type Auth = typeof auth;
