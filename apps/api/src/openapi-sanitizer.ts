import { isDeepStrictEqual } from 'util';

import type { OpenAPIObject } from '@nestjs/swagger';

function stripUnsupportedKeywords(obj: unknown): void {
  if (obj === null || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    obj.forEach(stripUnsupportedKeywords);
    return;
  }

  const record = obj as Record<string, unknown>;
  delete record['propertyNames'];

  if (typeof record['exclusiveMinimum'] === 'number') {
    record['minimum'] = record['exclusiveMinimum'];
    record['exclusiveMinimum'] = true;
  }

  if (typeof record['exclusiveMaximum'] === 'number') {
    record['maximum'] = record['exclusiveMaximum'];
    record['exclusiveMaximum'] = true;
  }

  if (Array.isArray(record['anyOf'])) {
    const anyOf = record['anyOf'];
    const nullIdx = anyOf.findIndex((s: any) => s?.type === 'null');

    if (nullIdx !== -1) {
      anyOf.splice(nullIdx, 1);
      record['nullable'] = true;

      if (anyOf.length === 1) {
        Object.assign(record, anyOf[0], { nullable: true });
        delete record['anyOf'];
      }
    }
  }

  Object.values(record).forEach(stripUnsupportedKeywords);
}

function patchMissingPathParams(paths: OpenAPIObject['paths']): void {
  for (const [pathKey, pathItem] of Object.entries(paths || {})) {
    const pathParams = (pathKey.match(/\{([^}]+)\}/g) || []).map((m) =>
      m.slice(1, -1),
    );

    for (const value of Object.values(pathItem as any)) {
      const method = value as any;

      if (
        !method ||
        typeof method !== 'object' ||
        !('parameters' in method || 'operationId' in method)
      ) {
        continue;
      }

      if (!method.parameters) method.parameters = [];

      const declared = new Set(
        method.parameters
          .filter((p: any) => p.in === 'path')
          .map((p: any) => p.name),
      );

      for (const paramName of pathParams) {
        if (!declared.has(paramName)) {
          method.parameters.push({
            name: paramName,
            in: 'path',
            required: true,
            schema: { type: 'string' },
          });
        }
      }
    }
  }
}

// nestjs-zod 5 emits `.meta({ id })` schemas as $defs but its cleanupOpenApiDoc
// prefixes each occurrence with the parent DTO name (e.g. `GetTaskDrawerBundleResponseDtoTaskMember`)
// because zod 4 consumes id as the def key but doesn't write it into the body —
// the cleanup checks the body for `id` to skip prefixing. we post-process here:
// auto-derive canonical ids from the schemas dump (any name that another name
// suffix-matches), verify bodies are byte-equal modulo ref-rewrite, then collapse.
//
// no hand-curated list — adding `.meta({ id })` to a new schema is sufficient.

function rewriteRefs(value: unknown, renames: Record<string, string>): void {
  if (value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((v) => rewriteRefs(v, renames));
    return;
  }

  const record = value as Record<string, unknown>;

  if (typeof record['$ref'] === 'string') {
    const ref = record['$ref'];
    const match = ref.match(/^#\/components\/schemas\/(.+)$/);

    if (match && renames[match[1]]) {
      record['$ref'] = `#/components/schemas/${renames[match[1]]}`;
    }
  }

  for (const v of Object.values(record)) rewriteRefs(v, renames);
}

/**
 * Nest/Swagger + Fastify can add a `search` field on path items for `@All('*')`
 * (Better Auth catch-all). OpenAPI 3 / Orval reject it.
 */
const PATH_OR_OP_JUNK_KEYS = new Set(['search']);

function stripInvalidPathAndOps(paths: OpenAPIObject['paths']): void {
  if (!paths) return;

  const httpMethods = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace',
  ] as const;

  for (const pathItem of Object.values(paths)) {
    if (pathItem === null || typeof pathItem !== 'object') continue;
    const item = pathItem as Record<string, unknown>;

    for (const key of Object.keys(item)) {
      if (PATH_OR_OP_JUNK_KEYS.has(key)) delete item[key];
    }

    for (const method of httpMethods) {
      const op = item[method];
      if (op === null || typeof op !== 'object') continue;
      const opRec = op as Record<string, unknown>;
      for (const key of Object.keys(opRec)) {
        if (PATH_OR_OP_JUNK_KEYS.has(key)) delete opRec[key];
      }
    }
  }
}

// returns a deep clone with $refs rewritten through `renames`, without mutating input.
function cloneWithRefRewrite(
  value: unknown,
  renames: Record<string, string>,
): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value))
    return value.map((v) => cloneWithRefRewrite(v, renames));

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(record)) {
    if (k === '$ref' && typeof v === 'string') {
      const m = v.match(/^#\/components\/schemas\/(.+)$/);

      if (m && renames[m[1]]) {
        out[k] = `#/components/schemas/${renames[m[1]]}`;
        continue;
      }
    }
    out[k] = cloneWithRefRewrite(v, renames);
  }

  return out;
}

function collectRefTargets(value: unknown, into: Set<string>): void {
  if (value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((v) => collectRefTargets(v, into));
    return;
  }

  const record = value as Record<string, unknown>;

  if (typeof record['$ref'] === 'string') {
    const m = record['$ref'].match(/^#\/components\/schemas\/(.+)$/);
    if (m) into.add(m[1]);
  }

  for (const v of Object.values(record)) collectRefTargets(v, into);
}

// derives the meaningful "inner id" tail from a possibly-prefixed schema name.
// nestjs-zod's cleanup forms `<DtoClassName><InnerId>` where the dto class name
// always ends in `Dto` (e.g. `GetTaskDetailsResponseDto` + `TaskMember`). we
// split on the LAST occurrence of `Dto` to recover the inner id. names that are
// themselves a top-level dto class (ending in `Dto`) yield an empty tail and
// are skipped — those names are public contract surface, never canonical bodies.
function meaningfulTail(name: string): string {
  const idx = name.lastIndexOf('Dto');
  if (idx === -1) return name;
  return name.slice(idx + 3);
}

function dedupeSharedSchemas(doc: OpenAPIObject): void {
  const schemas = doc.components?.schemas;

  if (!schemas) return;

  const allNames = Object.keys(schemas);

  // only schemas that are referenced from elsewhere in the doc are eligible for
  // dedupe. top-level response/request DTOs (which nothing $refs to) are public
  // contract surface and must never be collapsed into each other.
  const refdNames = new Set<string>();

  collectRefTargets(doc, refdNames);

  if (refdNames.size === 0) return;

  // group refd names by meaningful tail. covers both:
  //   1. explicit canonical — `Task` exists at top level, plus `<Dto>Task`
  //      prefixed copies; all share tail `Task`.
  //   2. implicit canonical — only `<Dto>DubLink` copies exist; they share
  //      tail `DubLink` even though no top-level `DubLink` exists yet.
  const tailGroups = new Map<string, string[]>();

  for (const n of refdNames) {
    if (!allNames.includes(n)) continue;

    const tail = meaningfulTail(n);

    if (!tail) continue;

    if (!tailGroups.has(tail)) tailGroups.set(tail, []);

    tailGroups.get(tail)!.push(n);
  }

  if (tailGroups.size === 0) return;

  // initial candidates: every non-canonical-named member of a group renames
  // to its tail. used during inner-ref normalisation in verification.
  const candidates: Record<string, string> = {};

  for (const [tail, names] of tailGroups) {
    for (const n of names) {
      if (n !== tail) candidates[n] = tail;
    }
  }

  // verify per group. for each group, all duplicate bodies must match (after
  // normalising inner refs through the candidate map). for implicit canonicals
  // the first verified body is hoisted under the tail name.
  const renames: Record<string, string> = {};

  for (const [tail, names] of tailGroups) {
    const dupNames = names.filter((n) => n !== tail);
    if (dupNames.length === 0) continue;

    const explicit = allNames.includes(tail) ? schemas[tail] : null;
    const normalised = dupNames.map((n) =>
      cloneWithRefRewrite(schemas[n], candidates),
    );
    const reference = explicit ?? normalised[0];
    if (!reference) continue;

    const allMatch = normalised.every((b) => isDeepStrictEqual(b, reference));
    if (!allMatch) continue;

    for (const n of dupNames) renames[n] = tail;
    if (!explicit) schemas[tail] = reference;
  }

  if (Object.keys(renames).length === 0) return;

  rewriteRefs(doc, renames);

  for (const n of Object.keys(renames)) delete schemas[n];
}

// `@ZodResponse({ type: [Dto] })` (array form) emits response `$ref`s pointing
// at the DTO class name (e.g. `UserDto`) while the schema component itself is
// registered under the zod meta id (e.g. `User`). The cleanup pass that walks
// `components.schemas` never sees the dangling-ref side, so it can't rewrite
// it. Detect each `XxxDto` $ref whose target is missing but whose Dto-stripped
// counterpart exists, and rewrite. Caveat: only acts when the shorter name
// resolves — never invents schemas.
function fixDanglingDtoRefs(doc: OpenAPIObject): void {
  const schemas = doc.components?.schemas;
  if (!schemas) return;

  const allRefs = new Set<string>();
  collectRefTargets(doc, allRefs);

  const renames: Record<string, string> = {};

  for (const name of allRefs) {
    if (schemas[name]) continue;
    if (!name.endsWith('Dto')) continue;
    const stripped = name.slice(0, -'Dto'.length);
    if (schemas[stripped]) renames[name] = stripped;
  }

  if (Object.keys(renames).length === 0) return;
  rewriteRefs(doc, renames);
}

export function sanitizeOpenApiDoc(doc: OpenAPIObject): OpenAPIObject {
  stripUnsupportedKeywords(doc.components?.schemas);
  stripInvalidPathAndOps(doc.paths);
  patchMissingPathParams(doc.paths);
  dedupeSharedSchemas(doc);
  fixDanglingDtoRefs(doc);
  return doc;
}
