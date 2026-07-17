// strongly-typed Prisma JSON columns. annotate a `Json` column in the schema with
// a doc-comment (e.g. `/// [FooMeta]`) and declare the matching type here under the
// PrismaJson namespace — the generator wires it into both reads and writes.
//
// boundary types derive from zod (`z.infer<...>`). empty for now — add types as the
// first Json columns land.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace PrismaJson {
    // add JSON column types here as features land.
  }
}

export {};
