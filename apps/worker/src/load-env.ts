import * as dotenv from 'dotenv';

// Preload runs before nest's ConfigModule — and before the module-level Inngest
// clients (worker + mastra) construct — so INNGEST_DEV (and anything else the SDK
// reads at import time) is in process.env in time for the SDK to boot in DEV mode.
// Without it the clients boot cloud-mode and the dev server's sync fails with
// "Expected server kind cloud, got dev". No-op in prod (no .env file; env comes
// from the deploy environment). Must be the first import in main.ts.
dotenv.config({ path: './apps/worker/.env' });
