// packages/cdd-engine/src/documents/schema.ts — canonical doc-structure schema loader (P2 T1 ④;
// design §2.3). Single-point loader for the canonical JSON Schemas (draft 2020-12 + descriptions)
// that define the four CDD doc types (overall / plan / phase-spec / add-phase-protocol). The
// canonical files live at src/documents/schema/ — the single source of truth; `pnpm build` copies
// them to dist/documents/schema/ (build.config.ts copy entry) so the published package (files:
// dist/) ships the addressable copy. Resolution is published-path-first (the consumer face), with
// the source tree as the dev fallback (before a stub/build has materialized the copy). Pure read
// layer — zero transactional behavior: no writes, no dispatch, no audit.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { invariant } from "../infra/exit.ts";
import { resolvePackageRoot } from "../infra/resource.ts";

export const DOC_SCHEMA_NAMES = ["overall", "plan", "phase-spec", "add-phase-protocol"] as const;
export type DocSchemaName = (typeof DOC_SCHEMA_NAMES)[number];

/** The canonical doc-structure schema directory — the published addressable path (dist copy, the
 * face a consumer install ships and `cdd help` prints) first, the source tree as the dev fallback.
 * Optional fromDir: path.dirname(fileURLToPath(import.meta.url)) via the caller — tests exercise
 * the resolver against fabricated install layouts by passing an explicit directory. */
export function resolveDocSchemaDir(fromDir = path.dirname(fileURLToPath(import.meta.url))): string {
  const root = resolvePackageRoot(fromDir);
  const published = path.join(root, "dist", "documents", "schema");
  if (existsSync(published)) return published;
  const source = path.join(root, "src", "documents", "schema");
  if (existsSync(source)) return source;
  invariant(false, `doc-structure schema directory not found under ${root}`);
  return ""; // unreachable — invariant throws
}

// Per-schema parse cache (same shape as the rules/schema.ts cache for the shipped handoff schemas).
const CACHE = new Map<DocSchemaName, unknown>();

/** Single-point canonical schema loader — parse-on-demand, cached. */
export function loadDocSchema(name: DocSchemaName): unknown {
  const cached = CACHE.get(name);
  if (cached !== undefined) return cached;
  const file = path.join(resolveDocSchemaDir(), `${name}.json`);
  invariant(existsSync(file), `doc-structure schema file not found: ${file}`);
  const schema = JSON.parse(readFileSync(file, "utf8")) as unknown;
  CACHE.set(name, schema);
  return schema;
}

/** The canonical doc-structure schema directory (help/consumer discovery surface). */
export function docSchemaDir(): string {
  return resolveDocSchemaDir();
}