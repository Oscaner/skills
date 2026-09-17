// packages/cdd-engine/src/rules/schema.ts — handoff JSON-schema validation + handoff-namespace
// canonical read (Task 5 rules-layer rebuild; ex src/rules/schema.mjs). The two handoff schemas
// ship in templates/schema/ (task — implement/review/fix/branch-review handoffs; docs — doc
// review handoffs). Ajv validates against the canonical; the normalize → re-validate unit
// (T5) keeps CONTRACT_VIOLATION recovery lossless across the three recovery consumers.
// Status derivation reuse: rollupStatus stays in artifacts/handoff/finalize.mjs (its single
// owner, spec §2.3) — this file never writes a second severity→status mapping. The legacy
// schema.mjs↔finalize.mjs intentional mutual import is not replicated here: schema.ts → finalize.mjs
// is one-directional (finalize.mjs still imports schema.mjs, the legacy copy, until Task 8).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv, { type ValidateFunction } from "ajv";

import { rollupStatus } from "../artifacts/handoff/finalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// From src/rules/ → packages/cdd-engine/ (2 levels up — same relative depth as the legacy copy).
const PKG_ROOT = path.resolve(__dirname, "..", "..");

const SCHEMA_PATHS: Record<string, string> = {
  task: path.join(PKG_ROOT, "templates", "schema", "task-handoff-schema.json"),
  docs: path.join(PKG_ROOT, "templates", "schema", "docs-handoff-schema.json"),
};

// Per-schema lazy caches: { validator, schema }.
const CACHE = new Map<string, { schema: unknown; validator: ValidateFunction }>();

function getEntry(schemaName = "task") {
  if (CACHE.has(schemaName)) return CACHE.get(schemaName)!;
  const schemaPath = SCHEMA_PATHS[schemaName];
  if (!schemaPath) throw new Error(`unknown handoff schema: ${schemaName}`);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv({ allErrors: true });
  const entry = { schema, validator: ajv.compile(schema) };
  CACHE.set(schemaName, entry);
  return entry;
}

// Returns the raw JSON Schema object (for renderHandoffStub).
export function loadHandoffSchema(schemaName = "task"): unknown {
  return getEntry(schemaName).schema;
}

// Validates a handoff object against the named schema ('task' | 'docs').
// Returns {valid: true} or {valid: false, reason: string, property?: string}.
export function validateHandoffSchema(
  obj: unknown,
  schemaName = "task",
): { valid: true } | { valid: false; reason: string; property?: string } {
  const { validator } = getEntry(schemaName);
  const valid = validator(obj);
  if (valid) return { valid: true };
  const errors = validator.errors ?? [];
  const err = errors.find((e) => e.keyword === "additionalProperties");
  const reason = errors
    .map((e) =>
      `${e.instancePath || "/"}${e.params?.additionalProperty ? ` (unexpected key: ${e.params.additionalProperty})` : ""} ${e.message}`,
    )
    .join("; ")
    .trim();
  return { valid: false, reason, property: err?.params?.additionalProperty };
}

// Array guard single point: agent-written `findings` / `unverifiable` / `plan_conflicts` are
// often "none" / {} / a number. rollupStatus's findings.some(...) would throw on a non-array,
// escaping along the runner's try/finally (no catch) to the bin top level — exit 2, no BLOCKED
// handoff written, findings lost. Both normalization and the recovery payload share this guard.
const arr = (v: unknown): Array<unknown> => (Array.isArray(v) ? v : []);

// Object guard (recovery payload only): normalizeHandoff passes non-objects through verbatim
// (a contract its own tests pin), so the recovery face closes on objects here: a hand-written
// BLOCKED carrier must never depend on the caller's spread semantics (spreading an array/string
// expands to indexed keys which the schema's additionalProperties rejects — the exact
// CONTRACT_VIOLATION shape this single point exists to eliminate).
const objOrEmpty = (o: unknown): Record<string, unknown> =>
  o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};

// Normalization single point (T5, same file as the validator → «normalize → re-validate» is one
// testable unit): three runners (run-task / run-docs / branch-review) share it on the
// CONTRACT_VIOLATION recovery path so findings survive in full (AC7 category-level). Three rules:
//   ① strip undeclared keys (the authoritative key set = schema.properties);
//   ② blocker: null → omit (schema declares string, null illegal);
//   ③ review family missing status → derive via findings roll-up (work types never derived:
//      the schema's else.required forces the agent to declare them).
// Side-effect free: returns a new object, never mutates; non-object input passes through
// verbatim (the recovery face closes it via objOrEmpty).
export function normalizeHandoff(
  obj: unknown,
  schemaName = "task",
): Record<string, unknown> | unknown {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const allowed = new Set(Object.keys((loadHandoffSchema(schemaName) as Record<string, unknown>).properties ?? {}));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (!allowed.has(key)) continue; // ①
    if (key === "blocker" && value === null) continue; // ②
    out[key] = value;
  }
  const phase = out.phase;
  if (!("status" in out) && (phase === "review" || phase === "branch-review")) {
    out.status = rollupStatus(arr(out.findings), arr(out.unverifiable), arr(out.plan_conflicts)); // ③
  }
  return out;
}

// CONTRACT_VIOLATION recovery single point (T5): normalize → re-validate (one round, no loop).
// Three runners (run-task / run-docs / branch-review) share it, each keeping only its
// failure-payload difference (BLOCKED wording prefix + guidance + counter branch).
// Returns:
//   valid: true  → handoff = normalized result (caller writes and continues);
//   valid: false → handoff = normalized result (violating keys stripped, usable as a BLOCKED
//                  payload base), property = violating key, reason = failure detail (with the
//                  violating-key suffix — the single assembly point), preservedFindings = the
//                  array-guarded original findings (AC7 full retention, guard written once).
export function recoverHandoff(
  obj: unknown,
  schemaName = "task",
): {
  handoff: Record<string, unknown>;
  valid: boolean;
  property?: string;
  reason?: string;
  preservedFindings?: Array<unknown>;
} {
  const handoff = objOrEmpty(normalizeHandoff(obj, schemaName));
  const sv = validateHandoffSchema(handoff, schemaName);
  if (sv.valid) return { handoff, valid: true };
  // The violating key is taken from the round that saw the ORIGINAL object — normalization
  // already stripped top-level unknown keys, so the re-validate surface usually no longer
  // reports additionalProperties; only the original object's keys tell the agent which key
  // was rejected. (Nested additionalProperties can still surface on the re-validate face, so
  // first-wins.)
  const property = (validateHandoffSchema(obj, schemaName) as Extract<ReturnType<typeof validateHandoffSchema>, { valid: false }>)
    .property ?? sv.property;
  return {
    handoff,
    valid: false,
    property,
    reason: `${property ? ` (unexpected key: ${property})` : ""}: ${sv.reason}`,
    preservedFindings: arr(handoff.findings),
  };
}

// handoff-namespace canonical read point (spec §2.13 rules/schema.ts row): workspaceRoot +
// family table (name / round semantics / prev) are declared once in templates/handoff-namespace.json;
// artifact/naming consumers (naming.ts in Task 8) read it here instead of a second literal copy.
export function loadHandoffNamespace(): unknown {
  return JSON.parse(readFileSync(path.join(PKG_ROOT, "templates", "handoff-namespace.json"), "utf8"));
}