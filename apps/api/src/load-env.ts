import * as dotenv from 'dotenv';

// Preload runs before nest's ConfigModule — and before the module-level Inngest
// client constructs — so INNGEST_DEV (and anything else the SDK reads at import
// time) is in process.env in time for the SDK to boot in DEV mode. Without it the
// client boots cloud-mode and the dev server's sync fails with
// "Expected server kind cloud, got dev". No-op in prod (no .env file; env comes
// from the deploy environment). Must be the first import in main.ts.
dotenv.config({ path: './apps/api/.env' });
