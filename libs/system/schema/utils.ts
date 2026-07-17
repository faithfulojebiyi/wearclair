import { z } from 'zod';

// Date <-> ISO string codec for response serialization + OpenAPI. The runtime/DB
// side is a Date; the wire side is an ISO string (JSON-schema-representable, unlike
// z.date()). Use in response schemas with createZodDto(..., { codec: true }).
export const dateToString = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});
