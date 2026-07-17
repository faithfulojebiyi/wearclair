import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// migrations + seed read the connection url from prisma/.env. the runtime client
// connects via the @prisma/adapter-pg driver adapter (see database.service.ts),
// so the schema datasource block itself carries no url.
loadEnv({ path: 'prisma/.env' });

export default defineConfig({
  schema: 'prisma/app/schema.prisma',
  migrations: {
    path: 'prisma/app/migrations',
  },
  datasource: {
    url: process.env['APP_DATABASE_URL'],
  },
});
