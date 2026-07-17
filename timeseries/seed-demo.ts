// demo seed: demo user + device + 60 days of cycle-shaped biomarker history + the
// derived daily insights. Idempotent — every step is an upsert or a no-op on re-run
// (the generator is pointwise deterministic and the tsdb dedupe index swallows
// duplicate samples). Run: bun run seed:demo   (requires: infra up, tsdb:migrate
// applied, prisma migrations applied)

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@orm/app';

import { generateSamples } from '@feature/biomarker-sim/generator';
import { classifyCycleDays } from '@feature/cycle-insights/classify';
import { auth } from '@system/auth/auth';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';
import { TsdbPool } from '@system/timeseries/timeseries.pool';

const DEMO_EMAIL = 'demo@wearclair.dev';
const DEMO_PASSWORD = 'wearclair-demo';
const DEMO_NAME = 'Demo';
const DEVICE_NAME = 'Clair Band';
const HISTORY_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.APP_DATABASE_URL,
  }),
});

const pool = new TsdbPool();
const store = new BiomarkerStore(pool);

try {
  // 1. demo user (better auth owns password hashing — sign up through it)
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
  });

  let userId: string;

  if (existing) {
    userId = existing.id;
    console.log(`user exists: ${DEMO_EMAIL}`);
  } else {
    const signedUp = await auth.api.signUpEmail({
      body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: DEMO_NAME },
    });
    userId = signedUp.user.id;
    console.log(`user created: ${DEMO_EMAIL}`);
  }

  // 2. demo device
  const device =
    (await prisma.device.findFirst({
      where: { userId, name: DEVICE_NAME },
    })) ??
    (await prisma.device.create({
      data: { userId, name: DEVICE_NAME },
    }));

  // 3. backfill the raw firehose (~86k rows: 5 metrics x 5-min grid x 60 days)
  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_DAYS * DAY_MS);
  const samples = generateSamples({ userId, from, to });
  const { inserted } = await store.insertBatch(userId, device.id, samples);
  console.log(
    `raw samples: ${samples.length} generated, ${inserted} inserted (rest deduped)`,
  );

  // 4. materialize the rollups now (outside any transaction) so charts have
  //    history immediately instead of waiting for the refresh policies
  await pool.query(
    `CALL refresh_continuous_aggregate('biomarker_1h', NULL, NULL)`,
  );
  await pool.query(
    `CALL refresh_continuous_aggregate('biomarker_1d', NULL, NULL)`,
  );

  // 5. derive insights directly (same pure classifier the worker uses — no queue
  //    round-trip needed for seeding)
  const stats = await store.queryDailyStats({
    userId,
    metrics: ['skin_temp', 'heart_rate', 'hrv'],
    from,
    to: new Date(to.getTime() + DAY_MS),
  });

  const samplesPerDay = new Map<number, number>();

  for (const stat of stats) {
    const key = stat.day.getTime();
    samplesPerDay.set(key, (samplesPerDay.get(key) ?? 0) + stat.count);
  }

  const insights = classifyCycleDays(stats);

  for (const insight of insights) {
    const dayStart = insight.date;
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    const data = {
      cycleDay: insight.cycleDay,
      phase: insight.phase,
      basalTempC: insight.basalTempC,
      restingHrBpm: insight.restingHrBpm,
      hrvRmssdMs: insight.hrvRmssdMs,
      readiness: insight.readiness,
      sourceFrom: dayStart,
      sourceTo: dayEnd,
      sourceSampleCount: samplesPerDay.get(dayStart.getTime()) ?? 0,
    };

    await prisma.dailyInsight.upsert({
      where: { userId_date: { userId, date: insight.date } },
      create: { userId, date: insight.date, ...data },
      update: data,
    });
  }

  console.log(`daily insights upserted: ${insights.length}`);

  // 6. stamp the device so the next simulate-sync starts from "now"
  await prisma.device.update({
    where: { id: device.id },
    data: { lastSyncedAt: to },
  });

  console.log('');
  console.log('demo ready:');
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  device:   ${device.id} (${DEVICE_NAME})`);
} finally {
  await pool.onModuleDestroy();
  await prisma.$disconnect();
}
