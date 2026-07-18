# Wearclair

Wearclair is a continuous hormone-intelligence platform for a wrist wearable. It turns temperature, heart rate, HRV, respiratory, EDA, arterial stiffness, perfusion, SpO₂, bioimpedance, and motion samples into cycle-phase, readiness, hormone, and health insights.

The repository contains a Fastify/NestJS API, a background worker, shared domain and infrastructure libraries, an Expo mobile app, and a separate Next.js dashboard. High-volume biomarker data lives in TimescaleDB; relational product data and derived insights live in a Prisma-managed PostgreSQL database.

[![Wearclair system architecture](./assets/architecture/system-architecture.png)](./assets/architecture/system-architecture.svg)

## Architecture at a glance

The API owns authenticated HTTP interactions and publishes typed events. Inngest invokes retryable worker stages that read time-series rollups and upsert derived product data. Clients query the API rather than either database directly.

The system diagram is embedded above and stored as a self-contained SVG. The complete architecture reference follows in this README so setup, runtime boundaries, data movement, reliability, and extension guidance stay in one place.

## Data lifecycle

```text
Clair band or local simulator
  → POST /devices/:deviceId/sync
  → raw_biomarker hypertable + relational SyncBatch
  → device/batch.synced Inngest event
  → worker daily rollups, cycle/readiness classification, and health insights
  → DailyInsight + HealthInsight upserts with raw-window lineage
  → biomarker, insight, and cycle query APIs
  → mobile and dashboard clients
```

![Wearclair biomarker data flow](./assets/architecture/biomarker-data-flow.svg)

Important properties of this flow:

- Raw inserts, event delivery, and derived writes are designed for safe replay.
- Inngest separates the worker into independently retryable steps.
- Late samples re-derive and repair affected days through stable upsert keys.
- AI-generated health cards fall back to deterministic rules when the model is unavailable.
- Cross-database lineage is stored by value; the two databases have no foreign keys between them.

## Runtime architecture

| Component | Responsibility | Entry point |
| --- | --- | --- |
| Expo mobile | Authentication, buffered band simulation/sync, and consumer views | `mobile/src/app/` |
| Next.js dashboard | Browser client and authenticated workspace | `dashboard/src/app/` |
| API | Fastify/NestJS REST API, OpenAPI, CQRS, Mastra routes, and event publication | `apps/api/src/main.ts` |
| Worker | Separate NestJS application serving retryable Inngest functions | `apps/worker/src/main.ts` |
| Inngest | Typed event transport, durable execution, deduplication, retries, and step memoization | `inngest.yaml` |
| App PostgreSQL | Auth, devices, sync batches, cycle logs, and derived insights | `prisma/app/schema.prisma` |
| TimescaleDB | Raw biomarker samples and 1-hour/1-day aggregates | `timeseries/migrations/` |
| Mastra storage | Agent runtime state and memory, isolated from product data | `libs/providers/mastra/` |
| Shared libraries | Infrastructure, providers, simulation, and pure insight logic | `libs/` |

The API and worker are separate NestJS applications. They share libraries but never import one another. The worker does not use API request-scoped ALS; user identity required by background work travels in typed event data. Inngest is the event and durable-execution layer between them—there is no BullMQ queue in this path.

### API request lifecycle

1. Fastify assigns or preserves `x-request-id` and applies body limits, CORS, Helmet, cookies, compression, and multipart handling.
2. Better Auth owns raw routes under `/api/auth/*`.
3. Every Nest controller route is protected by the global `SessionGuard` unless marked `@Public()`.
4. The guard resolves the session, attaches it to the request, and writes `userId` into API-only ALS.
5. Zod parses boundary DTOs; thin controllers dispatch typed CQRS commands or queries.
6. Handlers access relational data through `AppPrismaService`, time-series data through `BiomarkerStore`, and integrations through provider services.
7. Zod validates/encodes responses and `AllExceptionsFilter` normalizes errors.

Swagger/OpenAPI is served at `/api` and generates the mobile and dashboard clients. HTTP, CQRS, service, event, and Inngest boundary types derive from Zod schemas with stable metadata IDs.

### API module responsibilities

- `devices`: registration, ownership-aware listing, real batch ingestion, and deterministic sync simulation.
- `biomarkers`: latest samples and bucketed series from TimescaleDB.
- `insights`: daily and health-insight reads from app PostgreSQL.
- `cycle`: logs, predictions, calendar, and timeline composition.
- `event-publisher`: typed Inngest publication and API-side function registration.
- `health`: runtime dependency checks.

Mastra is mounted globally through the Fastify adapter at `/mastra/*`. Its runtime state is stored separately from Wearclair product data.

## Storage ownership

Wearclair uses separate relational and time-series databases because their access patterns and lifecycles differ.

### App PostgreSQL

The `wearclair` database is accessed through `AppPrismaService` and owns:

- Better Auth users, sessions, accounts, and verification records;
- registered devices and `SyncBatch` state;
- `DailyInsight` cycle, readiness, and hormone derivations;
- AI- or rule-generated `HealthInsight` cards; and
- user-authored `CycleLog` events.

`APP_DATABASE_REPLICA_URL` optionally enables transparent read-replica routing.

### TimescaleDB

The `wearclair_tsdb` database is accessed through `BiomarkerStore` and owns:

- the narrow `raw_biomarker` hypertable;
- `biomarker_1h` and `biomarker_1d` continuous aggregates; and
- retention and compression behavior defined by reviewed SQL under `timeseries/migrations/`.

There are no cross-database foreign keys or distributed transactions. Derived rows record `source_from`, `source_to`, and `source_sample_count`, preserving raw-window lineage by value while allowing each database to evolve independently.

Locally, the TimescaleDB container on port `6543` hosts three logical databases: `wearclair`, `wearclair_tsdb`, and `wearclair_mastra`.

## Ingestion and background derivation

Real device sync and `POST /devices/:deviceId/simulate-sync` converge on `IngestBatchCommand`:

1. ALS supplies `userId`, and the handler verifies device ownership.
2. Samples are inserted into `raw_biomarker` first using chunked `UNNEST` writes and `ON CONFLICT DO NOTHING`.
3. Prisma records a `SyncBatch` in `RECEIVED` state and advances `Device.lastSyncedAt` when appropriate.
4. The API publishes typed `device/batch.synced` with ID `device-batch-<batchId>` for delivery deduplication.

The worker serves functions at `:3311/api/inngest`. `compute-daily-insights` runs four named, independently retryable steps:

1. `load-daily-stats` reads required metrics from `biomarker_1d`.
2. `classify-and-upsert` derives cycle phase, readiness, and hormone estimates and upserts `DailyInsight` by `(userId, date)`.
3. `build-health-insights` generates cards and upserts them by `(userId, date, key)`.
4. `mark-batch-processed` changes the source batch from `RECEIVED` to `PROCESSED`.

Completed Inngest steps are memoized. A transient failure resumes from the failed boundary. Late raw samples re-derive the loaded window, and stable upsert keys repair historical days without duplication.

### Classifier and AI fallback

`libs/feature/cycle-insights` contains pure domain logic. It converts daily temperature, resting-heart-rate, and HRV summaries into cycle phase, cycle day, readiness, and estimated estradiol, progesterone, LH, and FSH values.

Health insights are AI-first when `ANTHROPIC_API_KEY` is configured. Model output is constrained with Zod before persistence. Missing credentials, provider failures, or invalid output invoke deterministic rules, keeping local development and the demo functional without an external call.

## Client read paths

- `/biomarkers/latest` and `/biomarkers/series` read TimescaleDB.
- `/insights`, `/insights/today`, and `/insights/health` read derived relational data.
- `/cycle/predictions`, `/cycle/calendar`, `/cycle/timeline`, and `/cycle/logs` compose insights with user logs.

The Expo app uses generated OpenAPI functions with TanStack Query. After sync, it invalidates device, biomarker, and insight queries so the UI refetches server-owned truth. The Next.js dashboard uses its own generated client and credentialed Better Auth cookies.

## Reliability and failure boundaries

- Raw writes are idempotent through a time-series dedupe index and `ON CONFLICT DO NOTHING`.
- Stable event IDs deduplicate repeated batch publication.
- Named Inngest steps isolate retries and memoize completed work.
- Daily and health insights use stable unique keys and Prisma upserts.
- AI failures fall back to deterministic rules instead of failing the feed.
- A batch remains `RECEIVED` until every worker stage succeeds.
- Raw-window lineage is stored by value because cross-database transactions and foreign keys are intentionally absent.
- HTTP errors are normalized and retain request IDs in structured Pino logs.

## Supporting services

- `CacheModule` can use Valkey through `APP_REDIS_URL`; it remains available but no current product flow depends on it, so cache is omitted from the architecture diagram.
- `StorageModule` wraps S3-compatible storage. Local Ministack exposes it on port `4567` and initializes `wearclair-uploads`.
- `ResendModule` wraps outbound email delivery.
- The API Mastra adapter serves HTTP routes; the worker uses the shared Mastra runtime without importing API code.
- Observability uses Pino—pretty logs in development and JSON in production. OpenTelemetry and Sentry are not installed.

## Repository map

```text
wearclair/
├── apps/
│   ├── api/          # authenticated REST API, CQRS features, OpenAPI, Inngest publisher
│   └── worker/       # Inngest consumers and background insight derivation
├── libs/
│   ├── system/       # auth, ALS, cache, database, queues, time-series, logging
│   ├── providers/    # S3, Resend, and Mastra integrations
│   └── feature/      # pure simulator and cycle-insight domain logic
├── prisma/app/       # relational app schema; generated client is imported as @orm/app
├── timeseries/       # reviewed TimescaleDB SQL, migration runner, and demo seed
├── mobile/           # separate Expo app with generated OpenAPI client
├── dashboard/        # separate Next.js app with generated OpenAPI client
└── assets/architecture/ # self-contained architecture diagrams and README preview
```

## Demo quickstart

Requirements: Node.js 24, Bun 1.3.14 or newer, and Docker.

```bash
bun install
bun run infra:up
bun run tsdb:migrate
bun run prisma:migrate:app
bun run seed:demo
```

Start the backend processes in separate terminals:

```bash
bun run start:dev:api
bun run start:dev:worker
bun run inngest:dev
```

Start the mobile app:

```bash
cd mobile
bun install
bun start
```

Seeded demo credentials:

```text
demo@wearclair.dev
wearclair-demo
```

Use the app's sync action to send locally generated band samples through the real ingest path. Watch `compute-daily-insights` in the Inngest UI, then see Today, Perform, Cycle, and Insights refetch the server-derived results.

## Setup from scratch

Install dependencies for the backend and each separate client application:

```bash
bun install
bun --cwd dashboard install
bun --cwd mobile install
```

Create local environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp dashboard/.env.example dashboard/.env
```

Create `prisma/.env` for Prisma CLI commands:

```dotenv
APP_DATABASE_URL=postgresql://postgres:postgres@localhost:6543/wearclair
```

Generate the Prisma client:

```bash
bun run prisma:generate
```

Do not hand-write Prisma migration files. The user applies app-schema changes deliberately with `bun run prisma:migrate:app`. Time-series DDL is reviewed SQL under `timeseries/migrations/` and is applied with `bun run tsdb:migrate`.

Physical mobile devices need `EXPO_PUBLIC_API_URL` in `mobile/.env` set to the development machine's LAN address, such as `http://192.168.1.20:3310`. The API listens on `0.0.0.0`.

## Development commands

### Backend and shared libraries

```bash
bun run build                 # typecheck/build api and worker
bun run lint                  # eslint --fix for apps and libs
bun run format                # prettier for apps and libs
bun test apps libs            # backend/shared test suite
bun run prisma:generate       # regenerate @orm/app
bun run tsdb:migrate          # apply reviewed time-series SQL
bun run tsdb:generate         # refresh reference SQL generated by @timescaledb/core
bun run seed:demo             # idempotent demo data seed
bun run infra:logs            # follow local infrastructure logs
bun run infra:down            # stop local backing services
```

### Mobile

```bash
bun --cwd mobile start
bun --cwd mobile run gen:api  # API must be running
```

### Dashboard

```bash
bun --cwd dashboard run dev
bun --cwd dashboard run gen:api  # API must be running
```

## Local services

| Service | Port |
| --- | ---: |
| API | 3310 |
| Worker | 3311 |
| Dashboard | 3010 |
| Inngest dev UI | 8288 |
| PostgreSQL/TimescaleDB | 6543 |
| Ministack S3 gateway | 4567 |

The local TimescaleDB container hosts three logical databases: `wearclair` for product data, `wearclair_tsdb` for biomarker time series, and `wearclair_mastra` for Mastra runtime state.

Important environment boundaries:

| Variable | Purpose |
| --- | --- |
| `APP_DATABASE_URL` | Relational product database |
| `APP_DATABASE_REPLICA_URL` | Optional relational read replica |
| `TSDB_DATABASE_URL` | Raw and aggregated biomarker database |
| `MASTRA_DATABASE_URL` | Mastra runtime persistence |
| `APP_REDIS_URL` | Optional shared cache backend |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Credentialed CORS allowlist |
| `INNGEST_DEV=1` | Route SDK traffic to local Inngest |
| `ANTHROPIC_API_KEY` | Optional AI health-insight generation |

The API and worker load separate `.env` files, Prisma CLI commands read `prisma/.env`, and each client owns its environment configuration. Use the checked-in `.env.example` files as the current variable reference and never commit secrets.

## Extending Wearclair

### Add an endpoint

Add a command for a write or a query for a read inside the owning API feature. Define Zod schemas and `createZodDto` classes, dispatch from a thin controller, register the handler in the feature module, and keep persistence behind `AppPrismaService` or `BiomarkerStore`. Response DTOs use codec mode.

### Add a biomarker metric

Extend the shared time-series Zod enum and the simulator or classifier mappings that understand it. The raw table remains narrow, so adding a metric does not add a column. Regenerate OpenAPI clients when the public schema changes.

### Add an event or worker stage

Define the event key and Zod payload under `libs/system/queues`, publish through `EventPublisherService`, and register the consumer in the owning Inngest registry. Pass identity in event data and isolate retryable work in named `step.run` stages.

### Change persistence

Relational models belong in `prisma/app/schema.prisma`; validate them with `bun run prisma:generate`. Do not hand-write Prisma migration files. Time-series DDL is reviewed SQL under `timeseries/migrations/` and applied with `bun run tsdb:migrate`.

### Add a client screen

Expose the server contract through Zod/OpenAPI, regenerate the relevant Orval client, and build the screen with generated request and response types. Keep derived health logic on the server so mobile and dashboard render the same source of truth.

## Code conventions

- Import through `@api/*`, `@worker/*`, `@system/*`, `@providers/*`, `@feature/*`, and `@orm/app` aliases.
- API and worker applications never import from each other; shared libraries never import either app.
- The worker never imports `@system/als`; identity required by background work travels in event data.
- HTTP, service, CQRS, event, and Inngest boundary types derive from Zod schemas.
- Relational access goes through `AppPrismaService`; time-series access goes through `BiomarkerStore`.
- Queue event names and payload schemas are centralized in `libs/system/queues`.
- Never generate Prisma migration files as a routine side effect. Time-series migrations are deliberately reviewed SQL.

These boundaries are architectural invariants: background work remains replay-safe, event contracts stay centralized, the worker never depends on API request context, and clients consume server-owned derived data through generated contracts.

## Diagram maintenance

The committed SVGs are canonical, self-contained artwork with embedded product assets:

- [System architecture](./assets/architecture/system-architecture.svg)
- [Biomarker data flow](./assets/architecture/biomarker-data-flow.svg)

Preserve their scalable `viewBox`, accessible title and description, dotted component/connector language, source-colored arrows, and distinction between current and planned behavior.
