// packages/cdd-engine/src/rules/schema.ts — HandoffSchemaValidator class (Task 5 rules-layer
// rebuild; ex src/rules/schema.mjs; Task 7 OOP restructure Criterion ② — per-schema validation +
// the handoff-namespace canonical read are instance methods with instance-owned lazy caches, zero
// bare function exports; the former module-level CACHE map becomes per-instance state — no
// module-level mutable surface). The two handoff schemas ship in config/schema/ (task —
// implement/review/fix/branch-review handoffs; docs — doc review handoffs). Ajv validates against
// the canonical.
// P6 T24 B: the CONTRACT_VIOLATION recovery unit (normalizeHandoff / recoverHandoff / the
// arr/objOrEmpty guards) moved to artifacts/handoff/finalize.ts (its applyDerivedStatus caller —
// finalize is the status-derivation sole owner; the schema⇄finalize direct cycle is broken:
// finalize → schema is now one-way, schema holds no applyDerivedStatus reference). This module
// keeps ONLY validation (+ the handoff-namespace canonical read) — consumers re-point normalize/
// recover to finalize.ts. Schema enforcement stays on this face only — no second enforcement
// implementation anywhere (Task 5 ② / Task 6 ④ measurement contract).
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv, { type ValidateFunction } from "ajv";

import { ConfigLoader } from "../infra/config.ts";
import { invariant } from "../infra/exit.ts";
import { resolveResource } from "../infra/resource.ts";

// The generic schema namespace (C7): config/schema/ — resolved through the logical-name locator
// (published dist mirror first, the source tree as the dev fallback), the same state-independent
// convention as infra/config.ts / documents/schema.ts / render/templates.ts.
const SCHEMA_PATHS: Record<string, string> = {
  task: path.join(resolveResource("schema"), "task-handoff-schema.json"),
  docs: path.join(resolveResource("schema"), "docs-handoff-schema.json"),
};

/** HandoffSchemaValidator — the handoff JSON-schema enforcement face (Criterion ②; constructor injection — the
 *  config source for the handoff-namespace canonical read, defaulting to a fresh ConfigLoader).
 *  Per-schema lazy ajv caches live on the instance ({ validator, schema } per schemaName) — the
 *  former module-level CACHE map is per-instance state, never shared mutable module state. */
export class HandoffSchemaValidator {
  readonly #config: ConfigLoader;
  #cache = new Map<string, { schema: unknown; validator: ValidateFunction }>();

  constructor(config: ConfigLoader = new ConfigLoader()) {
    this.#config = config;
  }

  #getEntry(schemaName = "task"): { schema: unknown; validator: ValidateFunction } {
    if (this.#cache.has(schemaName)) return this.#cache.get(schemaName)!;
    const schemaPath = SCHEMA_PATHS[schemaName];
    invariant(schemaPath, `unknown handoff schema: ${schemaName}`);
    const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
    const ajv = new Ajv({ allErrors: true });
    const entry = { schema, validator: ajv.compile(schema) };
    this.#cache.set(schemaName, entry);
    return entry;
  }

  // Returns the raw JSON Schema object (for renderHandoffSchemaJson).
  loadHandoffSchema(schemaName = "task"): unknown {
    return this.#getEntry(schemaName).schema;
  }

  // Validates a handoff object against the named schema ('task' | 'docs').
  // Returns {valid: true} or {valid: false, reason: string, property?: string}.
  validateHandoffSchema(
    obj: unknown,
    schemaName = "task",
  ): { valid: true } | { valid: false; reason: string; property?: string } {
    const { validator } = this.#getEntry(schemaName);
    const valid = validator(obj);
    if (valid) return { valid: true };
    const errors = validator.errors ?? [];
    const err = errors.find((e) => e.keyword === "additionalProperties");
    const reason = errors
      .map(
        (e) =>
          `${e.instancePath || "/"}${e.params?.additionalProperty ? ` (unexpected key: ${e.params.additionalProperty})` : ""} ${e.message}`,
      )
      .join("; ")
      .trim();
    return { valid: false, reason, property: err?.params?.additionalProperty };
  }

  // handoff-namespace canonical read point (spec §2.13 rules/schema.ts row): workspaceRoot +
  // family table (name / round semantics / prev) are declared once in config/engine-config.json
  // #handoffNamespace (Task 5: merged into a single module); artifact/naming consumers (naming.ts in Task 8) read it
  // here instead of a second literal copy. Public seam kept (rules.schema.test still tests this export) —
  // value source moved to the config.ts single point (D1.5 ⑤).
  loadHandoffNamespace(): unknown {
    return this.#config.handoffNamespace();
  }
}
