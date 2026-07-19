# Wearclair mobile

The consumer app is an Expo 57 / React Native application using Expo Router, Better Auth,
TanStack Query, and TinyBase. It shows biomarker readings, cycle and readiness derivations,
health-insight cards, and the local band-sync simulator.

## Run locally

Install from the repository root, then start Expo:

```bash
bun --cwd mobile install
bun --cwd mobile start
```

Platform-specific commands are also available:

```bash
bun --cwd mobile run ios
bun --cwd mobile run android
bun --cwd mobile run web
```

The API defaults to `http://localhost:3310`. A physical device cannot resolve the development
machine through `localhost`, so create `mobile/.env` and use the machine's LAN address:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.20:3310
```

The backend listens on `0.0.0.0`; the phone and development machine must be on the same network.

## Data and sync model

- TinyBase stores the latest readings and pending samples locally first. Native builds persist it
  through Expo SQLite; web uses the browser-backed adapter.
- Foreground and background flushes send deterministic batches through the authenticated device
  sync endpoint. A content-derived key makes retrying the same local samples idempotent.
- Successful sync immediately refreshes device and raw-backed biomarker queries.
- Worker-derived insight and cycle queries refresh when the signed-in user's Inngest Realtime
  channel reports that the batch is `PROCESSED`. A 10-second delayed invalidation is the fallback
  when realtime is unavailable.
- Local stores are owned by the authenticated account. An account change gates rendering while
  TinyBase and the TanStack Query cache are cleared, preventing cross-account data display.

## Generated API client

The generated OpenAPI client lives in `src/api/generated/`. Start the API on the configured URL,
then regenerate it with:

```bash
bun --cwd mobile run gen:api
```

Do not hand-edit generated client files.

## Checks

```bash
bun test mobile
bunx tsc -p mobile/tsconfig.json --noEmit
bun --cwd mobile run lint
```

Expo changes quickly. Before implementation work, consult the exact Expo 57 documentation as
required by `mobile/AGENTS.md`.
