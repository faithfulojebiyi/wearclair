// AI-generated health insights via the Vercel AI SDK + Anthropic provider.
// generateObject constrains the model to a zod schema, so output is validated and
// safe to persist. This is the primary path; buildHealthInsightDrafts (the pure rule
// engine) is the deterministic fallback used when ANTHROPIC_API_KEY is unset or the
// model call fails — so the demo always has a feed and the AI is an enhancement.

import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

import { Logger } from '@nestjs/common';

import { PerDayInsight } from './classify';
import {
  HealthInsightDraft,
  buildHealthInsightDrafts,
} from './health-insights';

// default to the current Claude model; override with AI_INSIGHTS_MODEL.
const MODEL = process.env.AI_INSIGHTS_MODEL ?? 'claude-opus-4-8';

const logger = new Logger('ai-insights');

const draftSchema = z.object({
  insights: z
    .array(
      z.object({
        key: z
          .string()
          .describe('stable kebab-case slug identifying this insight type'),
        category: z.enum([
          'fertility',
          'energy',
          'cycle',
          'recovery',
          'vitals',
        ]),
        priority: z.enum(['high', 'normal', 'low']),
        title: z.string().describe('short headline, max ~6 words'),
        body: z
          .string()
          .describe('one or two warm, factual sentences for the user'),
        detail: z
          .string()
          .optional()
          .describe('optional metric callout, e.g. "Estrogen 268 pg/mL"'),
      }),
    )
    .min(1)
    .max(6),
});

// compact, factual summary of the latest day + recent baseline for the prompt
const summarize = (days: PerDayInsight[]): string => {
  const today = days[days.length - 1];
  const prior = days.slice(Math.max(0, days.length - 15), days.length - 1);
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

  return JSON.stringify({
    today: {
      phase: today.phase,
      cycleDay: today.cycleDay,
      readiness: today.readiness,
      basalTempC: today.basalTempC,
      restingHrBpm: today.restingHrBpm,
      hrvRmssdMs: today.hrvRmssdMs,
      hormones: today.hormones,
    },
    baseline14d: {
      restingHrBpm: Number(avg(prior.map((d) => d.restingHrBpm)).toFixed(1)),
      hrvRmssdMs: Number(avg(prior.map((d) => d.hrvRmssdMs)).toFixed(1)),
      basalTempC: Number(avg(prior.map((d) => d.basalTempC)).toFixed(2)),
    },
  });
};

const SYSTEM = `You are Clair, a women's health companion. From a day's decoded biomarker and hormone data you write short, warm, factual insight cards for the wearer. Ground every statement in the numbers provided — never invent values. Cover the most relevant of: fertile window / ovulation, energy, cycle phase, recovery, and notable vitals. One card per distinct topic. Keep titles short and bodies to one or two sentences.`;

// AI-first with deterministic fallback. Returns validated drafts either way.
export const generateHealthInsightDrafts = async (
  days: PerDayInsight[],
): Promise<HealthInsightDraft[]> => {
  if (days.length === 0) {
    return [];
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return buildHealthInsightDrafts(days);
  }

  try {
    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema: draftSchema,
      system: SYSTEM,
      prompt: `Today's decoded data:\n${summarize(days)}\n\nWrite the insight cards.`,
    });

    return object.insights;
  } catch (error) {
    // gateway/key/parse failure — deterministic rules keep the feed alive, but
    // the failure must be visible: a bad key or model id is otherwise silent forever
    const reason = error instanceof Error ? error.message : String(error);

    logger.warn(
      `AI insight generation failed (model=${MODEL}) — falling back to rule engine: ${reason}`,
    );

    return buildHealthInsightDrafts(days);
  }
};
