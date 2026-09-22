// packages/cdd-engine/src/rules/schema.ts — handoff JSON-schema validation + handoff-namespace
// canonical read (Task 5 rules-layer rebuild; ex src/rules/schema.mjs). The two handoff schemas
// ship in templates/schema/ (task — implement/review/fix/branch-review handoffs; docs — doc
// review handoffs). Ajv validates against the canonical.
// P6 T24 B: the CONTRACT_VIOLATION recovery unit (normalizeHandoff / recoverHandoff / the
// arr/objOrEmpty guards) moved to artifacts/handoff/finalize.ts (its applyDerivedStatus caller —
// finalize is the status-derivation sole owner; the schema⇄finalize direct cycle is broken:
// finalize → schema is now one-way, schema holds no applyDerivedStatus reference). This module
// keeps ONLY validation (+ the handoff-namespace canonical read) — consumers re-point normalize/
// recover to finalize.ts.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv, { type ValidateFunction } from "ajv";

import { loadEngineConfig } from "../infra/config.ts";
import { invariant } from "../infra/exit.ts";
import { resolvePackageRoot } from "../infra/resource.ts";

// PKG_ROOT = <pkg>/templates — resolved by the nearest-ancestor package.json marker walk (same
// state-independent convention as infra/config.ts / documents/schema.ts / render/templates.ts). The
// legacy `../..` hop was calibrated to src/rules/ but lands two levels too high from the real
// bundle (dist/, consumer install), breaking the runtime reads of the shipped handoff JSON schemas
// in the published package.
const PKG_ROOT = path.join(resolvePackageRoot(path.dirname(fileURLToPath(import.meta.url))), "templates");

const SCHEMA_PATHS: Record<string, string> = {
  task: path.join(PKG_ROOT, "schema", "task-handoff-schema.json"),
  docs: path.join(PKG_ROOT, "schema", "docs-handoff-schema.json"),
};

// Per-schema lazy caches: { validator, schema }.
const CACHE = new Map<string, { schema: unknown; validator: ValidateFunction }>();

function getEntry(schemaName = "task") {
  if (CACHE.has(schemaName)) return CACHE.get(schemaName)!;
  const schemaPath = SCHEMA_PATHS[schemaName];
  invariant(schemaPath, `unknown handoff schema: ${schemaName}`);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv({ allErrors: true });
  const entry = { schema, validator: ajv.compile(schema) };
  CACHE.set(schemaName, entry);
  return entry;
}

// Returns the raw JSON Schema object (for renderHandoffSchemaJson).
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

// handoff-namespace canonical read point (spec §2.13 rules/schema.ts row): workspaceRoot +
// family table (name / round semantics / prev) are declared once in templates/engine-config.json
// #handoffNamespace (Task 5 单文件归并); artifact/naming consumers (naming.ts in Task 8) read it
// here instead of a second literal copy. Public seam kept (rules.schema.test 仍测本导出) —
// 值源改为 config.ts 单点（D1.5 ⑤）。
export function loadHandoffNamespace(): unknown {
  return loadEngineConfig().handoffNamespace;
}
