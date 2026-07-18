# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Required Skill: wearclair-module

Before doing any work in this repo, invoke the **wearclair-module** skill (`/wearclair-module` or via
the Skill tool). It carries the project's module layout, nestjs-zod DTO conventions, single-DB Prisma
rules, the "never write migration files" rule, path aliases, and Inngest event patterns that every
change must follow. This applies regardless of task size — a one-line fix still follows the conventions.

## Architecture Overview

Wearclair is a NestJS monorepo with two applications and shared libraries (the `dashboard/` directory
is a **separate** Next.js app with its own tooling — not part of the Nest build).

```
wearclair/
├── apps/
│   ├── api/        # HTTP API (Fastify): REST endpoints, publishes + serves Inngest functions
│   └── worker/     # background worker (Fastify): serves + consumes Inngest functions
├── libs/
│   ├── system/     # core infra: als, cache, cqrs, database, env, interceptors, logger, queues
│   ├── providers/  # external integrations (resend, s3)
│   └── feature/    # business-domain services (empty for now)
├── prisma/app/     # database schema (prisma/app/schema.prisma)
└── orm/app/        # generated Prisma client (gitignored) — imported as @orm/app
```

- **api** — handles client HTTP requests; auth/ALS/cache available; publishes Inngest events.
- **worker** — runs background jobs triggered by Inngest events. No ALS (it is HTTP-request-scoped).
  Thin Inngest functions dispatch to DI-resolved CQRS buses (passed in from `main.ts`) — business
  logic lives in command/query handlers, never inline in the function.
- Both apps register their **own** Inngest client (id `api` / `worker`) and serve `/api/inngest`.

## Build and Development Commands

```bash
bun install
bun run prisma:generate         # regenerate the Prisma client (@orm/app) — never write a migration file
bun run prisma:migrate:app      # YOU run migrations (needs prisma/.env with APP_DATABASE_URL)
bun run build                   # nest build api && nest build worker (full typecheck — use to verify)
bun run start:dev:api           # api in watch mode (port 3310)
bun run start:dev:worker        # worker in watch mode (port 3311)
bun run inngest:dev             # local Inngest dev server (UI on http://localhost:8288)
bun run infra:up                # ministack AWS emulator (S3 etc.) on http://127.0.0.1:4567 + bucket init
bun run infra:down              # stop it · bun run infra:logs tails it
bun run lint                    # eslint --fix
bun run format                  # prettier
bun test apps libs              # bun's test runner
```

## Path Aliases

Always import via aliases — never deep relative paths across modules.

| Alias          | Resolves to            |
| -------------- | ---------------------- |
| `@orm/app`     | generated Prisma client |
| `@api/*`       | `apps/api/src/*`       |
| `@worker/*`    | `apps/worker/src/*`    |
| `@system/*`    | `libs/system/*`        |
| `@providers/*` | `libs/providers/*`     |
| `@feature/*`   | `libs/feature/*`       |

## Import Restrictions (enforced by ESLint)

- `apps/api` cannot import from `apps/worker`, and vice versa.
- `apps/worker` cannot import `@system/als` (ALS is HTTP-request-scoped).
- `libs/*` cannot import from either app.

## Typing rules

- **No `as any`, `: any`, or `<any>` in app code.** If a seam is genuinely dynamic, use `unknown` with
  a narrowing helper (a zod parse or type guard).
- **Boundary types come from zod.** Anything crossing an HTTP / service / event / Inngest boundary
  derives from a zod schema (`z.infer<...>`), not a hand-written `interface`.
  - HTTP DTOs: `export class FooDto extends createZodDto(FooSchema) {}` (responses add `{ codec: true }`).
- **Every top-level zod schema gets `.meta({ id: 'X' })`** where `X` is the export name without the
  `Schema` suffix. nestjs-zod + Swagger use it for stable `$ref`s; without it SDK codegen breaks.
- **`zod` is pinned to `4.3.5` (no caret).** zod >= 4.4 strips the `id` from `$defs` bodies, which
  breaks nestjs-zod's `.meta({ id })` recovery (every schema falls back to its DTO class name).
  `nestjs-zod` (`5.3.0`) and `@nestjs/swagger` (`11.4.3`) are pinned for the same reason — don't bump.

### Prisma JSON columns

Typed via `prisma-json-types-generator`. Annotate the `Json` column with a doc-comment naming the type
and declare it under the `PrismaJson` namespace in `prisma/types.ts`:

```prisma
model Foo {
  /// [FooMeta]
  meta Json
}
```

Null sentinels (plain `null` does not satisfy Prisma's typed-JSON write signature):
- `Prisma.JsonNull` — writes JSON `null`. `Prisma.DbNull` — writes SQL `NULL`. `Prisma.AnyNull` —
  filter-only, matches both. Convert nullable reads with `meta: source.meta ?? Prisma.JsonNull`.

## Database

- PostgreSQL via Prisma 7 with the `@prisma/adapter-pg` driver adapter.
- Single client: inject `AppPrismaService` from `@system/database/database.service`. Schema:
  `prisma/app/schema.prisma`. Generated types: `@orm/app`.
- Read replicas are wired transparently via `@prisma/extension-read-replicas` (active only when
  `APP_DATABASE_REPLICA_URL` is set) — no API change for handlers.
- **Never write or generate a migration file.** Run `bun run prisma:generate` to validate the schema; the
  user runs `bun run prisma:migrate:app`.

## Event-Driven Communication (Inngest)

Publish from a handler via the app's `EventPublisherService`:

```ts
await this.eventPublisherService.sendEvent({
  name: 'job/hello.world',
  data: { /* typed against EVENTS */ },
  user: { userId },
});
```

Event names and zod schemas are centralized in `@system/queues/events.config` (`EVENT_KEYS`, `EVENTS`).
Add new events there so types flow through. Consumer functions live under
`apps/<app>/src/modules/event-publisher/` and are registered in that app's `inngest.registry.ts`.

Locally, `INNGEST_DEV=1` (in each app's `.env`) runs the SDK against `bun run inngest:dev`. The root
`inngest.yaml` registers both app endpoints (`http://localhost:3310|3311/api/inngest`) with the dev
server (`no-discovery: true`). Copy `apps/<app>/.env.example` → `apps/<app>/.env` to start.

## Environment

- Node.js 24, bun (>=1.3.14) as the package manager + test runner, TypeScript with `module: preserve` +
  `moduleResolution: bundler` (NOT nodenext — bundler resolution avoids CJS/ESM dual-type clashes with
  `inngest`/`@mastra/*` typings).
- **More pinned deps (don't bump casually):** `inngest@4.7.0`, `fastify@5.8.5` (must stay deduped to ONE
  copy each — a second copy breaks fastify plugin/inngest types), and `@mastra/*` pinned exact (the
  `libs/providers/mastra` Fastify adapter is written against those versions).
- Postgres (`APP_DATABASE_URL`), optional read replica (`APP_DATABASE_REPLICA_URL`), Valkey/Redis cache
  (`APP_REDIS_URL`). Each app reads its own `apps/<app>/.env`; migrations read `prisma/.env`.
- Default ports: api `3310`, worker `3311`, dashboard `3010`, Inngest dev UI `8288`. (Offset from the
  carbonme-hq sibling, which uses `3300`/`3301`/`3000`, so both can run at once.)
- **No OpenTelemetry / Sentry** — observability is plain pino logging (pretty in dev, JSON in prod).
