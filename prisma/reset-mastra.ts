import { spawnSync } from 'node:child_process';

// Mastra owns its OWN database (wearclair-mastra) — tables are created at runtime by
// PostgresStore (libs/providers/mastra/mastra.ts); Prisma never manages it. This
// wipes that database's public schema so chat threads/memory/runs start fresh;
// PostgresStore recreates its tables on the next boot.
const url = process.env.MASTRA_DATABASE_URL;
if (!url) {
  throw new Error(
    'MASTRA_DATABASE_URL is required — run via `bun run db:reset:mastra` (loads apps/api/.env).',
  );
}

// pass the connection string as an argv element (no shell) to avoid quoting issues.
const result = spawnSync(
  'psql',
  [
    url,
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
  ],
  { stdio: 'inherit' },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('✓ Mastra database wiped — tables recreated on the next boot.');
