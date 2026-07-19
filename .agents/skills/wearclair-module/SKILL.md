---
name: wearclair-module
description: "Build NestJS features in the wearclair monorepo. ALWAYS use this skill when working on the wearclair repo. Covers the api/worker layout, CQRS feature modules (commands/queries), nestjs-zod DTO conventions (createZodDto, ZodResponse, codec response serialization), single-DB Prisma access (AppPrismaService), ALS request context (api only), Inngest event publishing/consuming, path aliases, and the 'never write migration files' rule."
---

# Wearclair Backend Module Guide

Wearclair is a NestJS monorepo — apps `api` (HTTP) and `worker` (background jobs); shared libraries
under `libs/{system,providers,feature}`. Features in `api` live under `apps/api/src/modules/<feature>`
and follow a CQRS layout. Use this skill before adding endpoints, commands, queries, modules, or
Inngest functions so new code matches what already ships.

## When to use this skill

- **ALWAYS** when working in the wearclair repo, regardless of task size.
- Purely internal work (utils, types, providers) still follows the path aliases, the "no migration
  files" rule, and the nestjs-zod DTO convention.

## General rules and conventions

- Concise implementations. Don't over-abstract. Comments are short, lowercase, and explain the **why**.
- **NEVER write or generate a Prisma migration file.** Only run `bun run prisma:generate` to validate
  the schema and regenerate the client. The user runs `bun run prisma:migrate:app`. Reviewed
  TimescaleDB SQL is separate and belongs in `timeseries/migrations/`.
- Space code for readability: blank line before/after `if`/loops/blocks and before `return`.
- ESLint-enforced import boundaries (do not violate):
  - `apps/api` cannot import from `apps/worker`, and vice versa.
  - `apps/worker` cannot import `@system/als` (ALS is HTTP-request-scoped).
  - `libs/*` cannot import from either app.

### Typing

- **Zero `any` in app code** — no `as any`, `: any`, `<any>`, `Record<string, any>`. Use `unknown` plus
  a narrowing helper (a zod parse, a type guard) when a value is genuinely dynamic.
- **Boundary types derive from zod schemas.** Anything crossing an HTTP / service / event / Inngest /
  CQRS boundary is a zod schema with the TS type inferred — never a hand-written boundary `interface`.
- **Every top-level zod schema gets `.meta({ id: 'X' })`** (export name minus the `Schema` suffix).
- `zod` is pinned to `4.3.5`, `nestjs-zod` to `5.3.0`, `@nestjs/swagger` to `11.4.3` — don't bump them
  (zod >= 4.4 breaks nestjs-zod's `.meta({ id })` `$ref` recovery).
- See [AGENTS.md](../../../AGENTS.md) for the Prisma JSON-column pattern and null sentinels.

## api vs worker

- **`apps/api`** — HTTP API. Controllers + CQRS handlers. ALS request context. Publishes + serves
  Inngest functions. Root module: `apps/api/src/api.module.ts`.
- **`apps/worker`** — background worker. Serves + consumes Inngest functions. No ALS. Thin Inngest
  functions dispatch to DI-resolved `CommandBus`/`QueryBus` (passed in from `main.ts`); business logic
  lives in the handlers. Root module: `apps/worker/src/worker.module.ts`.

## Module layout (api feature)

```
apps/api/src/modules/<feature>/
├── <feature>.controller.ts        # HTTP boundary, dispatches to the bus
├── <feature>.module.ts            # @Module wiring
├── schema.ts                      # zod schemas (co-located with the feature)
├── dto/<feature>.dto.ts           # createZodDto classes used by controllers
├── commands/                      # write operations (one file per command)
│   └── do-the-thing.ts            # exports XCommand + XCommandHandler
└── queries/                       # read operations (one file per query)
    └── get-the-thing.ts           # exports XQuery + XQueryHandler
```

Shared **event** schemas (cross-app, used by both publishers and consumers) live in
`@system/queues/events.config` + `@system/queues/dto/`, not in a feature folder.

## Controller pattern

```ts
@ApiTags('Thing')
@Controller('thing')
export class ThingController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @ZodResponse({ type: ThingDto })
  @Post('create')
  async createThing(@Body() dto: CreateThingDto) {
    return this.commandBus.execute(new CreateThingCommand(dto));
  }
}
```

- Use `@ZodResponse({ type })` from `nestjs-zod` — never `@ApiResponse` / `@ApiBody`. nestjs-zod
  generates Swagger from the zod DTO.
- The controller only translates HTTP → bus dispatch.

## Commands and queries

Both extend the typed base classes from `@nestjs/cqrs` so the bus return type is inferred.

```ts
// commands/do-the-thing.ts
export class DoTheThingCommand extends Command<DoTheThingResponseDto> {
  constructor(public readonly dto: DoTheThingDto) {
    super();
  }
}

@CommandHandler(DoTheThingCommand)
export class DoTheThingCommandHandler implements ICommandHandler<DoTheThingCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService, // api only — worker cannot import it
  ) {}

  async execute(command: DoTheThingCommand) {
    // ...
  }
}
```

- One command/query per file. File `dash-case`; class `PascalCase` with `Command`/`Query` suffix; the
  handler has the matching `…CommandHandler` / `…QueryHandler` suffix. Export both from the same file.
- **Command = write/side effect. Query = pure read.**
- Every handler **must** be listed in the module's `providers` array, and the module imported by the
  app's root module — the CQRS bus won't find it otherwise.

## DTOs with nestjs-zod

```ts
// schema.ts
export const CreateThingSchema = z.object({ name: z.string() }).meta({ id: 'CreateThing' });

// dto/thing.dto.ts
export class CreateThingDto extends createZodDto(CreateThingSchema) {}
// response DTOs MUST pass { codec: true } so dates serialize/deserialize correctly
export class ThingDto extends createZodDto(ThingSchema, { codec: true }) {}
```

- `@Query()` values arrive as strings — use `z.coerce.number()` / `z.coerce.boolean()`.
- For Prisma enums from `@orm/app`, use `z.enum(MyEnum)` directly.

## Database (Prisma)

- Single client: inject `AppPrismaService` from `@system/database/database.service`. Schema:
  `prisma/app/schema.prisma`. Types: `@orm/app`.
- Read replicas are transparent (active only with `APP_DATABASE_REPLICA_URL`) — no API change.
- **Never write Prisma migration files.** Run `bun run prisma:generate`; the user runs them.
  TimescaleDB migrations are reviewed SQL under `timeseries/migrations/`.

## ALS (api only)

```ts
const requestId = this.alsService.ctx.get('requestId');
```

`AlsContext` lives in `@system/als/als.types` — currently minimal (`requestId`); extend it as auth /
tenancy lands. **The worker cannot use ALS** — pass any needed identity through the Inngest event data.

## Response wrapping

Controllers return raw payloads. Errors are normalized by the global `AllExceptionsFilter`
(`@system/interceptors/error.interceptor`) — throw NestJS exceptions (`BadRequestException`,
`NotFoundException`, etc.) directly; don't build error envelopes by hand.

## Inngest (publish + consume)

Publish from a handler:

```ts
constructor(private readonly eventPublisherService: EventPublisherService) {}

await this.eventPublisherService.sendEvent({
  name: 'job/hello.world',
  data: { /* typed against EVENTS */ },
  user: { userId },
});
```

Add event keys + schemas in [@system/queues/events.config](../../../libs/system/queues/events.config.ts)
so types flow through. A consumer function:

```ts
// apps/<app>/src/modules/event-publisher/<name>.function.ts
export const myJob = (deps: { workerService: WorkerService }) =>
  inngest.createFunction(
    { id: 'my-job', ...INNGEST_OPTIONS, triggers: [EVENTS.MY_EVENT] },
    async ({ event, step }) => {
      await step.run('do-work', () => deps.workerService.handle(event.data));
    },
  );
```

Register it in that app's `inngest.registry.ts`. Inngest functions are plain functions kept THIN:
resolve dependencies (services or the `CommandBus`/`QueryBus`) from DI in the app's `main.ts` and pass
them in via `deps`. Dispatching to CQRS handlers from inside a function is the intended pattern —
business logic lives in the handlers, never inline in the function. Never use ALS inside an Inngest
function (no HTTP request scope); identity travels in the typed event data.

Device sync durability depends on the existing state machine. Persist `SyncBatch.RECEIVED` before
the time-series write, attribute raw rows with `batch_id`, then advance through `RAW_WRITTEN`,
`PUBLISHED`, and worker-owned `PROCESSED`. Preserve the deterministic event ID and recovery sweep;
do not replace these transitions with an untracked cross-database write. The worker refreshes
completed continuous-aggregate buckets before reading daily stats and publishes realtime completion
only after processing.

## Build & verify

```bash
bun run prisma:generate            # regenerate the client after schema edits (no migration file!)
bun run build                      # nest build api && nest build worker — full TS compile / typecheck
bun run lint                       # eslint --fix
bun run start:dev:api              # api in watch mode
bun run start:dev:worker           # worker in watch mode
bun test apps libs timeseries      # bun's test runner
```

After adding a module, confirm: (1) handlers are in the module's `providers`; (2) the module is
imported by the app's root module; (3) `bun run build` passes (codec / zod issues surface here).

## Quick checklist for a new endpoint

1. Decide command vs. query.
2. Create `<name>.ts` under `commands/` or `queries/` with the class + decorated handler.
3. Add request/response schemas in the feature's `schema.ts` and DTO classes in `dto/`. Response DTOs
   use `{ codec: true }`.
4. Add the controller route with `@ZodResponse({ type })` dispatching via the bus.
5. Register the handler in the module's `providers`; ensure the module is in the app root module.
6. If the schema changed: run `bun run prisma:generate` (never write a migration file).
7. Run `bun run build` to typecheck.
