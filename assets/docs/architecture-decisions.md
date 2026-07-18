# Architecture decisions

This doc is me explaining the three decisions in this codebase that I'd expect a reviewer to
push on: why raw biomarker data lives in TimescaleDB rather than plain Postgres, why background
work runs on Inngest rather than a Redis-backed queue like BullMQ, and why the backend is two
deployables (`api` and `worker`) instead of one. For each, I lay out the workload that forced
the decision, the alternative I weighed, the tradeoffs I'm knowingly accepting, and the
conditions under which I'd reverse it.

One theme runs through all three: I tried to make every choice reversible behind a narrow seam.
A single env var and store interface for the time-series engine, a centralized event registry for
the queue transport, ESLint-enforced boundaries between the apps. The decisions below are the
ones I believe in today; the seams are how I stay honest about the fact that some of them will
be wrong at a different scale.

---

## 1. TimescaleDB, in its own database, not plain Postgres

### The workload

A wearable is a firehose with a very particular shape. Every sync lands a burst of samples (one
row per metric per timestamp) that is append-only, written once, and never updated. This
demo ingests 10 metrics on a 5-minute grid (~86k rows per user per 60 days); the real product
category is 130+ biomarkers at higher cadence, so the raw tier is heading toward billions of
rows. And almost nobody reads it raw: the app reads hourly/daily rollups for charts, and the
insight pipeline reads daily aggregates over a ~70-day window. Raw sample reads are the
exception, not the rule.

That's the exact workload time-series databases exist for, so I modeled it as one instead of
forcing it into the relational schema.

### What Timescale is actually doing for me here

Everything below lives in `timeseries/migrations/` as reviewed SQL. Three files, each doing one job:

**Hypertable partitioning** (`0001_raw_biomarker.sql`). `raw_biomarker` is a narrow five-column
table (`ts, user_id, device_id, metric, value`) declared as a hypertable with 7-day chunks.
Narrow on purpose: adding one of the "130 biomarkers" is a new whitelisted `metric` value
validated by zod app-side, not a DDL change. A 130-column wide table would turn every new
sensor into a migration and drown in nulls when domains sample at different rates. Chunking
means a "last 30 days" query prunes to five chunks instead of scanning history.

The same migration creates the unique index `(user_id, metric, ts, device_id)`, which pulls
double duty: it's the read-path index, and paired with `ON CONFLICT DO NOTHING` in
`libs/system/timeseries/biomarker.store.ts` it makes re-ingest of any window a no-op. BLE
devices re-sync overlapping windows constantly; I wanted idempotency in the storage layer,
not in application bookkeeping.

**Continuous aggregates** (`0002_continuous_aggregates.sql`). `biomarker_1h` and `biomarker_1d`
are the tables the product actually reads: charts hit them via
`apps/api/src/modules/biomarkers/queries/get-series.ts`, and the insight worker loads 70 days of
daily stats from `biomarker_1d` instead of aggregating millions of raw rows per event. Two
details I care about:

- They're declared `materialized_only = false` (a deliberate change from the current default),
  so a sync that just landed shows up in bucketed charts immediately, merged with the
  materialized portion, instead of waiting for the 15-minute refresh.
- When late data lands in an already-materialized bucket (the *normal* case for a BLE device
  that reconnects after hours offline), Timescale re-materializes the touched buckets on
  the next refresh. I don't own that invalidation logic, and that's the point.

**Columnstore compression** (`0003_columnstore.sql`). Raw chunks convert to columnstore after a
7-day hot window, segmented by `(user_id, metric)` and ordered by `ts DESC`, so each user's
per-metric stream stays contiguous, which is the shape both compression and the read path want.
On a narrow numeric firehose this is roughly an order of magnitude in storage, which is the
difference between "keep raw for a year" being a config line and being a budget meeting.
(Retention is deliberately *not* enabled yet; the commented-out `add_retention_policy` in that
file says why: rollups outlive raw, and raw's lifespan is a data-budget decision I didn't want
an engine default making for me.)

One honest note on tooling: I initially generated this DDL with `@timescaledb/core` and reviewed
it before committing, and the review caught a real bug: the generator emitted compression
options with double-quoted values, which Postgres parses as identifiers, not strings. The
reviewed files in `timeseries/migrations/` are the source of truth precisely because generated
SQL goes through eyes before it goes near a database. In a health-data context I consider
generate, review, then commit non-negotiable over any runtime auto-migration.

### What plain Postgres would have cost me

I want to be fair to the alternative, because vanilla Postgres *can* do all of this. Declarative
range partitioning covers chunking, `pg_partman` covers partition lifecycle, rollups become
matviews (or plain tables) refreshed by a scheduled job, and compression mostly doesn't exist
row-store, so you archive old partitions to S3/Parquet instead.

The problem isn't feasibility; it's that every one of those becomes code I own, test, and get
paged on. The late-data case makes it concrete: with a cron-refreshed rollup I either recompute
whole windows (wasteful), track dirty buckets myself (an invalidation system), or accept stale
charts after every burst sync (product-visible). Timescale collapses that entire category into
`add_continuous_aggregate_policy`. For a small team the calculus is simple: I'd rather spend
complexity on hormone classification than on rebuilding partition maintenance.

### Why a separate database, not just the extension in the app DB

This is the part I'd defend hardest, because the split costs something (no cross-database
foreign keys) and I chose it anyway. Three reasons:

1. **Different owners, different migration discipline.** The app DB is Prisma-managed;
   Prisma cannot express hypertables, continuous aggregates, or columnstore policies. Rather
   than smuggling hand-SQL into Prisma's migration stream, the time-series tier has its own
   reviewed migrations (`timeseries/migrations/*.sql`, applied by `timeseries/migrate.ts`) and
   its own client: a dedicated `pg.Pool` with UTC pinned
   (`libs/system/timeseries/timeseries.pool.ts`), never Prisma. The pool is explicitly capped
   at 10 per process (pg's default, stated rather than inherited) because the cap *is* the
   connection budget: both api and worker hold a tsdb pool, there's no PgBouncer in front, and
   Postgres backends are process-per-connection, so total demand is `10 × replicas × 2 apps`
   against a `max_connections` that defaults to 100. Ten is ample for this workload (reads are
   short indexed scans of the rollup views and writes are single batched `unnest` inserts), and
   when it saturates, `pg.Pool` queues callers, which is backpressure where I want it (in the
   app) instead of connection exhaustion where I don't (in the database). If the fleet grows
   past what per-process caps can budget, the fix is a pooler in front, not a bigger number here.

2. **Different scaling and cost curves.** OLTP point-writes and a compressed append-only
   firehose don't want the same instance size, storage class, or connection budget. Separate
   pools mean a heavy chart scan can't starve auth queries, and either store can move or resize
   without the other noticing.

3. **The seam keeps the engine swappable.** Everything above sits behind one env var
   (`TSDB_DATABASE_URL`) and one injectable store (`BiomarkerStore`). That matters because the
   managed-Postgres landscape constrains this choice: Aurora doesn't support the Timescale
   extension at all, and RDS only carries the community edition. Isolating the tier means
   "Timescale Cloud vs. self-hosted vs. partitioned vanilla Postgres" is a connection-string
   and DDL decision, not an application rewrite.

The price of no cross-DB FKs is paid with lineage-by-value: every derived `DailyInsight` row
carries `sourceFrom` / `sourceTo` / `sourceSampleCount` recording exactly which raw window
produced it (`prisma/app/schema.prisma:97-102`). I get auditability without coupling the two
stores' lifecycles.

### When I'd reverse this

If operating two databases ever outweighs the benefits (early-stage cost pressure, or a
platform mandate that everything runs on one managed instance), the same logical schema runs on
partitioned vanilla Postgres with job-refreshed rollups. Only the DDL and the `BiomarkerStore`
implementation change; the ingest contract, the events, and every consumer stay put. I sized
that escape hatch before committing.

---

## 2. Inngest over BullMQ

I've used Redis-backed queues; BullMQ is the default answer for background work in Node and it's
a good one. I still chose Inngest, and the reason is specific: when I listed what this pipeline
actually needs, almost none of it was *queueing*. It was flow control, and flow control is
exactly the part BullMQ leaves you to build.

### What the pipeline needs

Every device sync publishes one `device/batch.synced` event from the ingest path
(`apps/api/src/modules/devices/commands/ingest-batch.ts`). From that single event, two very
different jobs have to happen:

- a **cheap derivation** on every batch: read daily stats from the tsdb rollups, classify
  cycle days, upsert `DailyInsight` rows, mark the batch processed;
- an **expensive AI generation**: a Claude Opus call (`claude-opus-4-8` via
  `libs/feature/cycle-insights/ai-insights.ts`) that writes the narrative insight cards.

Real wearables sync every few minutes. Running the model call per batch means paying Opus
tokens dozens of times a day to rewrite the same day's cards, and putting seconds of inference
latency adjacent to the ingest hot path. So the actual requirements were: fan-out (two
consumers, one event), per-user debouncing with a hard cap, dedup of redelivered events,
partial retries that don't redo completed work, and failure visibility.

### How each requirement is met, concretely

**Fan-out.** `compute-daily-insights`
(`apps/worker/src/modules/insights/queues/device-batch-synced.event.ts`) and
`refresh-health-insights` (`refresh-health-insights.event.ts`) both declare
`triggers: [EVENTS.DEVICE_BATCH_SYNCED]`. The publisher doesn't know consumers exist; adding a
third consumer is a new function, not a publisher change.

**Debounce.** The AI function declares
`debounce: { period: '10m', timeout: '30m', key: 'event.data.userId' }`: a burst of N syncs
coalesces into one run per user, delivered with the *last* event in the window, and the 30-minute
timeout guarantees a continuously-syncing user still gets a refresh. One line of config. On top
of it, a change-signature gate
(`apps/worker/src/modules/insights/commands/classify-and-upsert-health-insights.ts`) skips Opus
entirely when the day's numbers haven't moved. The signature is stamped only after a successful
card upsert, so a crash between generation and stamping regenerates rather than silently skips.

**Dedup.** The publisher sets `id: 'device-batch-${batch.id}'`, so Inngest treats redelivery of
the same batch as the same event. Belt and suspenders: the derivation is upsert-based and the
tsdb insert is `ON CONFLICT DO NOTHING`, because dedup-by-id narrows the at-least-once window
but idempotent handlers are what actually close it.

**Partial retries.** Each pipeline stage is a `step.run()`: load stats, classify-and-upsert,
mark processed. Steps are memoized: if the app-db write fails after the tsdb read succeeded, the
retry re-runs only the failed step. In BullMQ, retry granularity is the job; getting step-level
semantics means splitting one job into a chain of jobs and persisting intermediate state between
them. That's real architecture, invented per pipeline.

**Failure visibility.** A dedicated consumer on Inngest's built-in `inngest/function.failed`
event (`apps/worker/src/modules/event-publisher/failed-events.function.ts`) logs every function
that exhausts its retries (`retries: 1`, set centrally in
`libs/system/queues/events.config.ts`).

The whole surface is typed end-to-end: `events.config.ts` pairs each event key with a zod schema
(`eventType(EVENT_KEYS.X, { schema })`), so `sendEvent` payloads and consumer `event.data` are
inferred from the same source of truth that validates HTTP DTOs.

### What this would look like on BullMQ

Every piece above is buildable, and I know roughly what each costs because the failure modes are
well-worn: fan-out becomes one queue per consumer with the publisher enqueueing to all of them;
dedup becomes deterministic `jobId`s (plus knowing removed/completed jobs free their ids);
per-user debounce is the genuinely fiddly one: delayed jobs keyed by user, rescheduled on each
new arrival, with extra state to enforce the 30-minute hard cap, and tests for the races between
"job promoted" and "new event arrived." Plus a DLQ convention, a dashboard, and a Redis
deployment sized and persisted for queue durability rather than cache semantics. Notably,
Redis/Valkey *is* in this stack (`libs/system/cache/cache.module.ts`) and stays cache-only,
which means cache Redis can be small, evictable, and boring.

None of that is exotic. It's two or three weeks of infrastructure plus permanent ownership of
its edge cases, versus configuration, at a stage where the scarce resource is time spent on
the domain.

### The tradeoffs I'm accepting

Being honest about the other column:

- **A third party in the delivery path, but not a locked door.** In this deployment, events
  transit Inngest's cloud. For health data that was the first thing I checked: event payloads
  are batch *metadata* (ids, window bounds, sample counts; see `deviceBatchSyncedSchema`),
  never biomarker values; the data plane stays between my API, worker, and databases. And the
  dependency is softer than it looks: the Inngest server is source-available and self-hostable
  as a single binary (`inngest start`, also shipped as a Docker image and a Helm chart with KEDA
  autoscaling) backed by Postgres and Redis in production. So an in-VPC mandate means running
  one more service next to the databases I already operate, not a rewrite. The honest caveats:
  self-hosting hands back some of the ops I chose Inngest to avoid (sizing its Redis/Postgres,
  and pruning old run history, which the server doesn't do for itself), the license is SSPL
  with delayed Apache-2.0 conversion rather than plain OSS, and there's no guaranteed vendor
  support for self-hosted instances.
- **Latency.** HTTP-delivered function invocation will never beat a Redis `BRPOP`. Nothing in
  this pipeline is latency-sensitive at that scale; the expensive path is *deliberately*
  delayed by 10 minutes.
- **Semantics don't get outsourced.** Inngest is still at-least-once; idempotency remains my
  job (and is handled in storage, as above). Choosing a managed queue doesn't excuse you from
  understanding delivery semantics; it just changes who runs the broker.
- **Cost at scale** is per-run and would need re-modeling if event volume grows orders of
  magnitude; self-hosted BullMQ's marginal job is nearly free once you've paid for Redis and
  the ops.

### When I'd reverse this

There are two off-ramps, and they're importantly different in cost:

1. **In-VPC or pricing pressure → self-host Inngest.** Zero application change: the SDK, the
   functions, the debounce config, and the flow-control semantics are identical; only the
   server URL moves. This is the cheap exit, and it's the main reason I was comfortable
   building on Inngest's flow-control primitives instead of treating them as lock-in.
2. **Leaving the model entirely → BullMQ (or SQS at the AWS end-state).** The seam is
   `EventPublisherService` plus the centralized `EVENTS` registry. Consumers are plain
   functions that dispatch to CQRS command/query handlers; the business logic doesn't know
   Inngest exists. Swapping the transport means rewriting the thin function wrappers and
   rebuilding the debounce/fan-out plumbing by hand; the handlers, zod schemas, and idempotency
   guarantees carry over unchanged.

---

## 3. Two deployables: `api` and `worker`

### The split

`apps/api` (port 3310) owns everything request-shaped: REST controllers, Better Auth sessions,
and ALS request context, and it publishes events. `apps/worker` (port 3311) owns everything
event-shaped: it serves exactly one route, the Inngest function endpoint, and runs the
derivation and AI pipelines. Compare the root modules: `apps/api/src/api.module.ts` imports
`AlsModule`, `AuthModule`, and the Mastra HTTP adapter; `apps/worker/src/worker.module.ts`
imports none of those: no ALS, no auth, and `MastraRuntimeModule` (agent runtime only, no
routes). They build and ship separately (`build:api` / `build:worker` →
`dist/apps/{api,worker}/main`).

### Why

**Latency isolation.** The worker runs Opus calls that take seconds and rollup scans over 70
days of data. The API's job is p99 on auth'd reads. In one process those share an event loop
and a connection budget; a burst of batch processing shouldn't be able to make sign-in slow.
This is also why the AI call was moved off the ingest path entirely (the debounced function in
§2). The split and the debounce solve the same problem at two layers: the process boundary
protects HTTP from background load, and the debounce protects the background pipeline from
paying for work nobody asked for yet.

**Independent scaling and failure domains.** The API scales on request volume; the worker
scales on event backlog. Different signals, different replica counts, different resource
requests. In a Kubernetes environment that's two Deployments with their own HPAs. And the
failure isolation is real: a worker OOM from a pathological batch crash-loops the worker while
the app keeps serving reads.

**The boundary is enforced, not aspirational.** ESLint forbids `apps/api` ↔ `apps/worker`
imports, and forbids the worker from importing `@system/als` at all. That last rule encodes a
correctness invariant, not a style preference: ALS context is populated per HTTP request, so
"who is this for" must travel *in the event payload* (`user: { userId }`, typed in the event
schema) rather than being ambient. Making the wrong thing unimportable is cheaper than making
it a code-review convention.

### The cost

Two deploys, two env files, and shared-lib discipline (`libs/system`, `libs/feature`) so common
code has exactly one home. For a solo demo a single app with in-process consumers would have
been less ceremony. The NestJS monorepo keeps the marginal cost low (the apps share every
library and differ mainly in their root module), and I wanted the process boundary in place
*before* the workload forces it, because retrofitting one under load is when it's most
expensive.

### When I'd reverse this

If this were a low-traffic internal tool with no heavy background work, I'd collapse to one
app without hesitation; the split earns nothing there. It earns its keep exactly when
background work is slow, bursty, or expensive relative to request handling, which a
wearable-ingest + AI-generation workload is by construction.

---

## 4. Supporting decisions, briefly

**Lineage by value, not foreign keys.** Every derived row records the raw window that produced
it (`DailyInsight.sourceFrom/sourceTo/sourceSampleCount`). There are deliberately no
cross-database FKs: the stores stay independently movable, and I still get the audit question
answered: *what did we derive, from which inputs, over which window.* For derived health data I
treat that provenance as a product feature, not metadata.

**Debounce + change-gate on AI generation.** Two functions consume one event: numbers are
derived on every batch (cheap, users see fresh data immediately); narrative cards regenerate at
most once per user per 10-minute window, and only when the day's numbers actually changed. The
model call is also wrapped in a deterministic rule-based fallback
(`libs/feature/cycle-insights/ai-insights.ts`), so an AI outage degrades tone, not availability.

**One schema, every boundary.** Anything crossing HTTP, an event, or an env file derives from a
zod schema: controllers via `nestjs-zod` DTOs, events via the `EVENTS` registry, env via each
app's schema. The same schemas emit the OpenAPI document (with stable `$ref` ids via
`.meta({ id })`), from which the mobile client's SDK is generated
(`mobile/src/api/generated/`). The practical effect: the API can't drift from the app without
the type-checker noticing, and validation errors surface at the boundary they belong to.
