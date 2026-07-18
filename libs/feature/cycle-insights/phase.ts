import { z } from 'zod';

// cycle phases live in zod, NOT as a Postgres enum — adding or renaming one is a code
// change, not an `ALTER TYPE` migration. DailyInsight.phase is a plain String column
// validated against this schema at the boundary (same pattern as CycleLog.type and
// HealthInsight.category). The `.meta({ id })` keeps the OpenAPI $ref stable so the
// generated SDK type stays `CyclePhase` (a union), not `string`.
export const CyclePhaseSchema = z
  .enum(['MENSTRUAL', 'FOLLICULAR', 'OVULATORY', 'LUTEAL'])
  .meta({ id: 'CyclePhase' });

// the type and a value map share the name — mirrors how the old prisma enum was both
// a type (`CyclePhase`) and a value (`CyclePhase.MENSTRUAL`), so call sites are unchanged.
export type CyclePhase = z.infer<typeof CyclePhaseSchema>;
export const CyclePhase = CyclePhaseSchema.enum;

// narrow a stored string (the plain DB column) to the union at a read boundary. throws
// only on genuinely corrupt data, which is a bug — writes always go through the enum.
export const toCyclePhase = (value: string): CyclePhase =>
  CyclePhaseSchema.parse(value);
