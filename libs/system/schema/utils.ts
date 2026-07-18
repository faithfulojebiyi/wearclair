import { z } from 'zod';

// Date <-> ISO string codec for response serialization + OpenAPI. The runtime/DB
// side is a Date; the wire side is an ISO string (JSON-schema-representable, unlike
// z.date()). Use in response schemas with createZodDto(..., { codec: true }).
export const dateToString = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

export const DAY_IN_MS = 24 * 60 * 60 * 1000;

// bounds a { from, to } ISO-datetime pair: to must be after from, and the span
// must not exceed maxDays. use as `.superRefine(dateRangeWithin(400))` on query
// schemas so oversized ranges 400 at the boundary instead of hammering the db.
export const dateRangeWithin =
  (maxDays: number) =>
  (value: { from: string; to: string }, ctx: z.RefinementCtx): void => {
    const from = Date.parse(value.from);
    const to = Date.parse(value.to);

    if (to <= from) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'to must be after from',
      });

      return;
    }

    if (to - from > maxDays * DAY_IN_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: `range must not exceed ${maxDays} days`,
      });
    }
  };
