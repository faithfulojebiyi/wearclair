# Wearclair

Wearclair is a continuous hormone-intelligence platform for a wrist wearable: the backend turns a raw
biomarker stream (skin temperature, heart rate, HRV, respiratory rate, EDA, arterial stiffness,
perfusion index, SpO₂, bioimpedance, motion) into cycle-phase and readiness insights. Metrics are a
narrow-table `metric` enum value, so growing toward Clair's 130+ biomarkers is data, not a migration. The repo is a NestJS monorepo (api + worker) with a **TimescaleDB time-series
tier**, a separate Next.js dashboard, and an **Expo mobile app**.

The pipeline end-to-end:

```
device batch sync (POST /devices/:id/sync)
  -> raw_biomarker hypertable (TimescaleDB, raw pg via BiomarkerStore)
  -> 'device/batch.synced' Inngest event
  -> worker: classify cycle phase + readiness from daily rollups
  -> daily_insights (Prisma app db, with raw-window lineage columns)
  -> query API (time_bucket series, latest readings, insights)
  -> Expo app (Today / Trends / Device screens)
```

## Repository layout

```text
wearclair/
|-- apps/
|   |-- api/        # HTTP API: Better Auth, CQRS modules (devices, biomarkers, insights), Inngest publish/serve
|   `-- worker/     # background jobs: insight derivation consumers (CQRS via the bus)
|-- libs/
|   |-- system/     # auth, ALS, cache, database (Prisma), timeseries (TimescaleDB), env, logger, queues
|   |-- providers/  # storage, resend, Mastra runtime/Fastify adapter
|   `-- feature/    # biomarker-sim (deterministic generator), cycle-insights (classifier)
|-- timeseries/     # tsdb DDL migrations (reviewed SQL), migration runner, demo seed
|-- prisma/app/     # Prisma app schema (relational tier only)
|-- dashboard/      # separate Next.js 16 app, its own package.json/tooling
`-- mobile/         # separate Expo app (Expo Router), its own package.json/tooling
```

The generated Prisma client lives under `orm/app` and is imported as `@orm/app`.

## The two-database architecture

- **App database** (`wearclair`, Prisma): users/sessions, devices, sync batches, derived
  `daily_insights`. Single client via `AppPrismaService`.
- **Time-series database** (`wearclair_tsdb`, raw `pg`): the `raw_biomarker` hypertable plus
  `biomarker_1h`/`biomarker_1d` real-time continuous aggregates and columnstore compression. Accessed
  only through the `BiomarkerStore` repository (`@system/timeseries`) — swapping the backing store
  (local container → managed Timescale) is a `TSDB_DATABASE_URL` change.
- The tsdb schema ships as **reviewed SQL** in `timeseries/migrations/` (applied by
  `bun run tsdb:migrate`). `@timescaledb/core` is used as a dev-time SQL *generator*
  (`bun run tsdb:generate` → `timeseries/generated/`, reference only) and as the builder for
  `time_bucket` read queries — never as a runtime migrator.
- Insights reference raw windows via lineage columns (`source_from`/`source_to`/
  `source_sample_count`) — by value, no cross-database foreign keys.

Locally one TimescaleDB container (port **6543**) hosts all three databases (`wearclair`,
`wearclair_mastra`, `wearclair_tsdb`).

## Demo quickstart

```bash
bun install
bun run infra:up             # TimescaleDB (:6543) + ministack S3 emulator (:4567)
bun run tsdb:migrate         # hypertable, continuous aggregates, columnstore
bun run prisma:migrate:app   # app-db migrations (uses prisma/.env)
bun run seed:demo            # demo user + device + 60 days of cycle-shaped data + insights

# three terminals:
bun run start:dev:api        # :3310
bun run start:dev:worker     # :3311
bun run inngest:dev          # dev UI on :8288

# the app:
cd mobile && bun install && bun start   # Expo Go; sign in with the seeded credentials
```

Seeded credentials: `demo@wearclair.dev` / `wearclair-demo`.

Demo beats:

1. **Storage split** — Prisma owns relational; the firehose lives in a hypertable behind
   `BiomarkerStore`. Show `timeseries/migrations/0001–0003`: hypertable, real-time caggs,
   columnstore segmented by `(user_id, metric)`.
2. **Live pipeline** — press **Sync device** in the app: server-side generator → the real
   `POST /devices/:id/sync` path → idempotent UNNEST insert → `device/batch.synced` → watch the run
   in the Inngest UI → Today card and 6H chart update.
3. **Physiology** — Trends → skin temp at 30D/1d: the +0.4 °C luteal shift the classifier keys on;
   HRV shows the matching dip. The classifier is pure and unit-tested against the simulator
   (`libs/feature/cycle-insights/classify.spec.ts`).

Default local ports:

| Service | Port |
| --- | --- |
| api | 3310 |
| worker | 3311 |
| dashboard | 3010 |
| Inngest dev UI | 8288 |
| TimescaleDB (all 3 DBs) | 6543 |
| ministack S3 emulator | 4567 |

## Setup (from scratch)

Install backend dependencies from the repo root, then per-app deps:

```bash
bun install
cd dashboard && bun install
cd mobile && bun install
```

Create environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp dashboard/.env.example dashboard/.env
```

Create `prisma/.env` for Prisma commands:

```bash
APP_DATABASE_URL=postgresql://postgres:postgres@localhost:6543/wearclair
```

Generate the Prisma client:

```bash
bun run prisma:generate
```

Do not write migration files by hand. The app schema lives at `prisma/app/schema.prisma`; apply
schema changes deliberately with `bun run prisma:migrate:app`. The tsdb schema is separate reviewed
SQL under `timeseries/migrations/` applied with `bun run tsdb:migrate` (see above).

## Useful commands

Backend and shared libraries:

```bash
bun run build                 # build api and worker (full typecheck)
bun run lint                  # eslint --fix for apps/libs
bun run format                # prettier for apps/libs
bun test apps libs            # bun test runner (includes the classifier suite)
bun run prisma:generate       # regenerate @orm/app
bun run tsdb:migrate          # apply timeseries/migrations to wearclair_tsdb
bun run tsdb:generate         # refresh @timescaledb/core reference SQL (dev-time)
bun run seed:demo             # idempotent demo seed
bun run infra:logs            # follow ministack logs
bun run infra:down            # stop containers
```

Mobile (`mobile/`):

```bash
bun start                     # Expo dev server (Expo Go)
bun run gen:api               # regenerate OpenAPI client with orval (api must be running)
```

Physical devices need `EXPO_PUBLIC_API_URL` in `mobile/.env` set to your machine's LAN IP
(the api listens on `0.0.0.0`).

Dashboard (`dashboard/`):

```bash
bun run dev                   # Next dev server on :3010
bun run gen:api               # regenerate OpenAPI client with orval
```

## Code conventions

- Import via aliases: `@api/*`, `@worker/*`, `@system/*`, `@providers/*`, `@feature/*`, `@orm/app`.
- `apps/api` and `apps/worker` do not import from each other; `libs/*` do not import from apps.
- Worker code does not import `@system/als`; ALS is HTTP-request-scoped.
- HTTP/service/event/Inngest boundary types derive from zod schemas; top-level schemas use
  `.meta({ id: 'Name' })`; HTTP DTOs use `createZodDto`, response DTOs `{ codec: true }`.
- Relational access is `AppPrismaService` only; time-series access is `BiomarkerStore` only.
- Queue consumers are thin (`apps/worker/src/modules/<feature>/queues/*.event.ts`) and dispatch
  CQRS commands/queries onto the bus.
- Never generate Prisma migration files as a side effect of routine edits; tsdb DDL is reviewed SQL.
