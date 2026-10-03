// packages/cdd-engine/src/documents/schema.ts — canonical doc-structure schema loader (P2 T1 ④;
// design §2.3). Single-point loader for the canonical JSON Schemas (draft 2020-12 + descriptions)
// that define the five CDD doc types (overall / plan / phase-spec / add-phase-protocol /
// skill-anatomy). The canonical files live at config/schema/ (C7 — the generic schema namespace
// shared with the handoff + cache-profile schemas) — the single source of truth; `pnpm build`
// mirrors the config dir to dist/config (the tsc build's config copy) so the published package
// ships the addressable copy. Resolution is published-path-first (the consumer face) via the
// logical-name locator, with the source tree as the dev fallback. Pure read layer — zero
// transactional behavior: no writes, no dispatch, no audit.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { invariant } from "../infra/exit.ts";
import { resolveResource } from "../infra/resource.ts";

export const DOC_SCHEMA_NAMES = [
  "overall",
  "plan",
  "phase-spec",
  "add-phase-protocol",
  "skill-anatomy",
] as const;
export type DocSchemaName = (typeof DOC_SCHEMA_NAMES)[number];

/** The canonical schema directory — the generic config/schema/ namespace (published dist mirror,
 *  the face a consumer install ships and `cdd schema get` reads, first; the source tree as the
 *  dev fallback). Optional fromDir: path.dirname(fileURLToPath(import.meta.url)) via the caller —
 *  tests exercise the resolver against fabricated install layouts by passing an explicit directory. */
export function resolveDocSchemaDir(
  fromDir = path.dirname(fileURLToPath(import.meta.url)),
): string {
  return resolveResource("schema", fromDir);
}

// Per-schema parse cache (same shape as the rules/schema.ts cache for the shipped handoff schemas).
const CACHE = new Map<DocSchemaName, unknown>();

/** Single-point raw-text loader — the file bytes as-is (file resolution + read live here; parse
 *  stays in loadDocSchema). `cdd schema get` prints the canonical schema JSON byte-identical to
 *  the shipped file, and a JSON re-serialization of the parsed object is NOT byte-identical — the
 *  CLI reads this raw path, never JSON.stringify(parse). */
export function loadDocSchemaText(name: DocSchemaName): string {
  const file = path.join(resolveDocSchemaDir(), `${name}.json`);
  invariant(existsSync(file), `doc-structure schema file not found: ${file}`);
  return readFileSync(file, "utf8");
}

/** Single-point canonical schema loader — parse-on-demand, cached. */
export function loadDocSchema(name: DocSchemaName): unknown {
  const cached = CACHE.get(name);
  if (cached !== undefined) return cached;
  const schema = JSON.parse(loadDocSchemaText(name)) as unknown;
  CACHE.set(name, schema);
  return schema;
}
