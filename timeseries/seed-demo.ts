// demo seed: demo user + device + 4 months of cycle-shaped biomarker history + the
// derived daily insights. Idempotent — every step is an upsert or a no-op on re-run
// (the generator is pointwise deterministic and the tsdb dedupe index swallows
// duplicate samples). Run: bun run seed:demo   (requires: infra up, tsdb:migrate
// applied, prisma migrations applied)

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@orm/app';

import { cycleAnchorFor } from '@feature/biomarker-sim/cycle-model';
import { generateSamples } from '@feature/biomarker-sim/generator';
import { classifyCycleDays } from '@feature/cycle-insights/classify';
import { CyclePhase } from '@feature/cycle-insights/phase';
import { buildHealthInsightDrafts } from '@feature/cycle-insights/health-insights';
import { createAuth } from '@system/auth/auth';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';
import { TsdbPool } from '@system/timeseries/timeseries.pool';

const DEMO_EMAIL = 'demo@wearclair.dev';
const DEMO_PASSWORD = 'wearclair-demo';
const DEMO_NAME = 'Demo';
const DEVICE_NAME = 'Clair Band';
const HISTORY_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

// phase-appropriate cycle-log entries for a cycle day — drives a realistic timeline
// across every seeded cycle (menstrual flow, the fertile-window signals, luteal PMS).
// deterministic: same cycle day -> same entries. values mirror the Track catalog.
const phaseLogsFor = (cycleDay: number): { type: string; value: string }[] => {
  const logs: { type: string; value: string }[] = [];

  if (cycleDay <= 5) {
    logs.push({
      type: 'flow',
      value: cycleDay <= 2 ? 'Heavy' : cycleDay === 3 ? 'Medium' : 'Light',
    });
  }

  if (cycleDay === 1) {
    logs.push(
      { type: 'symptom', value: 'Cramps, Fatigue' },
      { type: 'mood', value: 'Sensitive' },
    );
  }

  if (cycleDay === 8) {
    logs.push(
      { type: 'mood', value: 'Happy' },
      { type: 'energy', value: 'Very energetic' },
    );
  }

  if (cycleDay === 13) {
    logs.push({ type: 'cervical_mucus', value: 'Egg white' });
  }

  if (cycleDay === 14) {
    logs.push(
      { type: 'ovulation_test', value: 'Positive' },
      { type: 'sex', value: 'High drive' },
    );
  }

  if (cycleDay === 21) {
    logs.push({
      type: 'diary',
      value: 'Steady week — sleeping well, calm energy.',
    });
  }

  if (cycleDay === 25) {
    logs.push(
      { type: 'symptom', value: 'Bloating, Tender breasts' },
      { type: 'mood', value: 'Irritable' },
    );
  }

  if (cycleDay === 27) {
    logs.push(
      { type: 'symptom', value: 'Cravings, Acne' },
      { type: 'mood', value: 'Anxious' },
    );
  }

  return logs;
};

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.APP_DATABASE_URL,
  }),
});

const pool = new TsdbPool();
const store = new BiomarkerStore(pool);
const auth = createAuth(prisma);

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

  // 3. backfill the raw firehose (~346k rows: 10 metrics x 5-min grid x 120 days)
  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_DAYS * DAY_MS);
  // pin the cycle so the current period starts mid-month (the 18th) — the whole
  // history + any later live sync share this anchor, so it's one continuous cycle.
  const cycleAnchorMs = cycleAnchorFor(to);
  const samples = generateSamples({ userId, from, to, cycleAnchorMs });
  const { inserted } = await store.insertBatch(userId, device.id, samples);
  console.log(
    `raw samples: ${samples.length} generated, ${inserted} inserted (rest deduped)`,
  );

  // 4. materialize the rollups now so charts have history immediately — stops at
  //    the current bucket start so the watermark never hides later live syncs
  await store.refreshChartRollups();

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
      estradiolPgMl: insight.hormones.estradiolPgMl,
      progesteroneNgMl: insight.hormones.progesteroneNgMl,
      lhMiuMl: insight.hormones.lhMiuMl,
      fshMiuMl: insight.hormones.fshMiuMl,
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

  // 6. backfill the Health Insights feed for the latest day (rule engine — no API
  //    key needed at seed time; the worker uses AI on live syncs)
  if (insights.length > 0) {
    const today = insights[insights.length - 1];
    const drafts = buildHealthInsightDrafts(insights);

    for (const draft of drafts) {
      const data = {
        category: draft.category,
        priority: draft.priority,
        title: draft.title,
        body: draft.body,
        detail: draft.detail ?? null,
      };

      await prisma.healthInsight.upsert({
        where: {
          userId_date_key: { userId, date: today.date, key: draft.key },
        },
        create: { userId, date: today.date, key: draft.key, ...data },
        update: data,
      });
    }

    console.log(`health insights upserted: ${drafts.length}`);
  }

  // 6.5 seed cycle logs on the `date` column: every menstrual day as a logged period
  //     day (makes the user period authoritative + gives predictions ≥2 starts to
  //     derive cycle length), plus phase-appropriate flow/symptom/mood/fertility
  //     entries across EVERY cycle so the timeline and calendar are populated for all
  //     ~4 months of history, not just the current one.
  const cycleLogs: { date: Date; type: string; value: string }[] = [];

  for (const insight of insights) {
    if (insight.phase === CyclePhase.MENSTRUAL) {
      cycleLogs.push({ date: insight.date, type: 'period', value: 'logged' });
    }

    for (const log of phaseLogsFor(insight.cycleDay)) {
      cycleLogs.push({ date: insight.date, ...log });
    }
  }

  for (const log of cycleLogs) {
    await prisma.cycleLog.upsert({
      where: {
        userId_date_type: { userId, date: log.date, type: log.type },
      },
      create: { userId, date: log.date, type: log.type, value: log.value },
      update: { value: log.value },
    });
  }

  console.log(`cycle logs upserted: ${cycleLogs.length}`);

  // 7. stamp the device so the next simulate-sync starts from "now"
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

// the @system/auth import holds module-level clients (its own prisma + valkey)
// with no close handle — exit explicitly so the event loop doesn't hang
process.exit(0);
