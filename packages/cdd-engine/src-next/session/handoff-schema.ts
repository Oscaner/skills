// packages/cdd-engine/src-next/session/handoff-schema.ts
// T15 v1.9 — the handoff schema face (design spec §3.6): the child's writable handoff
// contract as ONE typed declaration with TWO projections. The cutover deleted the old
// JSON schema file together with its Ajv loader; the structural constraint now lives
// here as a typed declaration — zero JSON schema files, one source, two consumers:
//
//   · projections: ① the prompt-injection text (schemaText — the ```json fences
//     byte-fixed per face, so the fixed prefix tail of the dispatch prompt stays
//     cache-friendly) and ② the engine read-back validator (violations /
//     evidenceViolations — the child draft is validated against exactly the same
//     declared objects the prompt showed it).
//   · faces: the per-family `schema` field of the handoff families (infra/runtime.ts)
//     selects the face — `work` (implement/fix: status+artifacts, plus the separate
//     test-evidence file for task-family rounds) or `findings` (reviews: findings-only
//     carrier — the engine rolls the status up from the findings, never a
//     child-authored status).
//
// The validator is a purpose-built walker over the declared schema objects (the
// keywords this contract uses — type / properties / required / items / enum /
// minLength / maxLength) — the new tree reads zero config files and takes no Ajv
// dependency; a wrong-shape child draft is the engine's read-back BLOCK, and the
// same declared objects drive both projections so the prompt can never show a
// schema the engine does not enforce. Non-declared fields are DROPPED by
// materialize and never refuse the draft — the validator and materialize judge the
// same field the same way (zero second-arbiter friction).
//
// Module-level exports are types / the declared schema objects / the class — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

import type { FindingSeverity, RoundFinding, RoundStatus } from "./ledger.ts";

/** The handoff schema faces — the `HandoffFamily.schema` selector values. */
export type HandoffSchemaFace = "work" | "findings";

/** The declared schema node shape — the typed subset of JSON-schema this contract
 *  uses (the engine's validator walks exactly these objects). */
interface SchemaNode {
  type?: "object" | "array" | "string" | "integer" | "boolean";
  required?: readonly string[];
  properties?: Readonly<Record<string, SchemaNode>>;
  items?: SchemaNode;
  enum?: readonly unknown[];
  minLength?: number;
  maxLength?: number;
}

/** One finding row — the shared base declaration of the findings face (severity +
 *  lens + summary required; the extra review columns — section / line / fix — are
 *  declared optional, and unknown extra fields ride along). */
const FINDING: SchemaNode = {
  type: "object",
  required: ["severity", "lens", "summary"],
  properties: {
    severity: { type: "string", enum: ["blocker", "warn", "nit"] },
    lens: { type: "string" },
    section: { type: "string" },
    line: { type: "integer" },
    summary: { type: "string" },
    fix: { type: "string" },
  },
};

/** The `work` writable subset — implement/fix carrier. `status` and `artifacts` are
 *  the round's required core; notes rides the declared optional field. Reserved
 *  fields (phase · tasks) are NOT declared and are DROPPED by materialize (never a
 *  BLOCK) — the engine stays the carrier's single author.
 *  `as const` preserves the literal property keys — the carrier type family
 *  (`CarrierOf<F>` below) derives its field set FROM these declared keys. */
const CARRIER_WORK = {
  type: "object",
  required: ["status", "artifacts"],
  properties: {
    status: { type: "string", enum: ["APPROVED", "BLOCKED"] },
    failure_category: { type: "string" },
    artifacts: { type: "object" },
    notes: { type: "array", items: { type: "string" } },
  },
} as const satisfies SchemaNode;

/** The `findings` writable subset — review + docs-fix carrier. NO status: the
 *  conclusion is derived from the findings at judgment time
 *  (`conclusionOf("findings", carrier)` → `rollup(findings)`), never a carrier field
 *  the child authors or the engine persists — the declaration plane IS the writable
 *  plane (one face, one field set). `as const` — see CARRIER_WORK. */
const CARRIER_FINDINGS = {
  type: "object",
  required: ["findings"],
  properties: {
    findings: { type: "array", items: FINDING },
    artifacts: { type: "object" },
    notes: { type: "array", items: { type: "string" } },
  },
} as const satisfies SchemaNode;

/** The test-evidence file schema — the evidence gate's engine read-back contract
 *  (the second fix for a prose-only claim: the old prompt asserted an engine read-back
 *  that the engine never performed; now both projections are real). A task-family
 *  work round missing or violating this file rewrites the round to BLOCKED. */
const EVIDENCE: SchemaNode = {
  type: "object",
  required: ["command", "exit_code", "passed", "warnings_count", "typecheck"],
  properties: {
    command: { type: "string" },
    exit_code: { type: "integer" },
    passed: { type: "boolean" },
    warnings_count: { type: "integer" },
    typecheck: {
      type: "object",
      required: ["command", "exit_code", "passed"],
      properties: {
        command: { type: "string" },
        exit_code: { type: "integer" },
        passed: { type: "boolean" },
      },
    },
    behavior_change: { type: "boolean" },
  },
};

/** The face → declared writable-subset table (the single source both projections read).
 *  `as const` keeps the declarations' literal property keys visible — the carrier type
 *  family's `[K in keyof (typeof BY_FACE)[F]["properties"]]` derives its field set from
 *  exactly these tables, so a schema edit reshapes the carrier types by construction. */
const BY_FACE = {
  work: CARRIER_WORK,
  findings: CARRIER_FINDINGS,
} as const satisfies Readonly<Record<HandoffSchemaFace, SchemaNode>>;

/** The carrier value-type mapping — every declared carrier field's value type. This
 *  is the ONE hand-maintained byte table (the type-level twin of the schema property
 *  values); `CarrierOf<F>` maps each declared key through it. A wrong entry reads as a
 *  build error at the first carrier read/write — it cannot silently pass. */
export type CarrierValue = {
  status: "APPROVED" | "BLOCKED";
  failure_category: string;
  artifacts: Record<string, string>;
  notes: string[];
  findings: {
    severity: "blocker" | "warn" | "nit";
    lens: string;
    section?: string;
    line?: number;
    summary: string;
    fix?: string;
  }[];
};

/** The derived carrier-of: the mapped type whose field set comes FROM the face's
 *  declared `properties` keys (the face dispatcher resolves which declared table the
 *  mapped type reads — `WorkCarrier`/`FindingsCarrier` are the two faces'
 *  instantiations, so a schema declaration change reshapes the carrier types by
 *  construction, zero hand-maintained parallel field tables). `-readonly` keeps the
 *  carrier MUTABLE — the round conclusion (status) rides the caller's set below the
 *  skeleton, never a frozen build-time value. */
export type CarrierOf<F extends HandoffSchemaFace> = F extends "work"
  ? { -readonly [K in keyof (typeof BY_FACE)["work"]["properties"]]: CarrierValue[K] }
  : { -readonly [K in keyof (typeof BY_FACE)["findings"]["properties"]]: CarrierValue[K] };

/** The work face's carrier — implement/fix write-back. Declared `findings`-free: the
 *  work writable subset declares no findings field, so the carrier type carries none —
 *  a `buildHandoff("work", { findings })` call is a compile-time refusal (Q1→c). */
export type WorkCarrier = CarrierOf<"work">;

/** The findings face's carrier — review write-back. `findings` is schema-required, so
 *  the carrier type always carries it (the compile-time twin of the required gate). */
export type FindingsCarrier = CarrierOf<"findings">;

/** One formed problem of a schema violation — the `path: reason` wording. */
export interface SchemaProblem {
  path: string;
  reason: string;
}

/**
 * HandoffSchema — one declaration, two projections. `violations(face, value)` is
 * the read-back validator (projection ② — the engine's seat, session plane);
 * `schemaText(face, evidence)` is the injected prompt text (projection ① — fixed
 * prefix tail, byte-stable per face so the dispatch prompt stays cache-friendly).
 * `rollup(findings)` derives the review conclusion the old JSON face rolled up.
 */
export class HandoffSchema {
  /** Projection ① — the `## Handoff schema` section text: the face's writable
   *  subset in a ```json fence + (work faces) the evidence file's schema in a second
   *  fence. The text is byte-stable per (face, evidence, prefix) — the fixed bytes
   *  of the dispatch prompt's contract surface. The evidence prefix is the family
   *  spine (§3.7 naming: `tasks-` for the task families, `branch-` for the branch
   *  fix — a branch evidence file never carries the misleading tasks- prefix). */
  schemaText(face: HandoffSchemaFace, evidence: boolean, evidencePrefix = "tasks"): string {
    const carrier = this.#json(BY_FACE[face]);
    let text = `Write the handoff draft at \`OUTPUT_HANDOFF\` per this writable subset — the engine validates it, then materializes the final carrier in place; fields not listed here are engine-reserved, do not write them.\n\n\`\`\`json\n${carrier}\n\`\`\``;
    if (evidence) {
      text += `\n\nThe evidence file (\`${evidencePrefix}-{key}-test-evidence.json\` under \`WORKSPACE_DIR\`) must comply with this schema — the engine reads it back with the same stakes:\n\n\`\`\`json\n${this.#json(EVIDENCE)}\n\`\`\``;
    }
    return text;
  }

  /** The declared evidence schema, as text (the evidence-gate prompt's shared fence). */
  evidenceSchemaText(): string {
    return this.#json(EVIDENCE);
  }

  /** Projection ② — validate a child draft against a face's writable subset. Every
   *  problem is a read-back BLOCK; the draft is left untouched for the child's
   *  resume (never overwritten — the engine never clobbers a child's work). */
  violations(face: HandoffSchemaFace, value: unknown): string[] {
    const problems: SchemaProblem[] = [];
    this.#check(BY_FACE[face], value, "", problems);
    return problems.map((problem) =>
      problem.path.length === 0 ? problem.reason : `${problem.path}: ${problem.reason}`,
    );
  }

  /** Projection ② — validate the test-evidence file (task-family work rounds). */
  evidenceViolations(value: unknown): string[] {
    if (value === null || value === undefined) return ["the evidence file is missing"];
    const problems: SchemaProblem[] = [];
    this.#check(EVIDENCE, value, "", problems);
    return problems.map((problem) =>
      problem.path.length === 0 ? problem.reason : `${problem.path}: ${problem.reason}`,
    );
  }

  /** The round conclusion, DERIVED at judgment time from the face's own plane — the
   *  single source the review/fix ledger legs read (D27 · judgment face ⊥ input face).
   *  The findings face rolls its conclusion UP from its findings (defined for every
   *  carrier — a review never carries a child-authored status, and the persisted
   *  findings carrier holds none). The work face reads its DECLARED status, and the
   *  absence of a declaration is itself a fact: an ABSENT status → `undefined` (no
   *  conclusion was declared — never an invented approval OR an invented failure ·
   *  D27 present-facts-only), while a PRESENT-but-invalid byte (outside the enum the
   *  schema pinned) degrades to BLOCKED — the conservative reading of a malformed
   *  declaration. `undefined` is DISTINCT from BLOCKED to the caller (the router
   *  treats undefined as "not a failure", a declared BLOCKED as the failure face), so
   *  a work carrier that predates the status field never reads as a fabricated
   *  failure. `carrier` is the on-disk carrier (or a freshly built one) — the
   *  conclusion is never a stored field, so any face's carrier derives it the same way. */
  conclusionOf(face: HandoffSchemaFace, carrier: Record<string, unknown>): RoundStatus | undefined {
    if (face === "findings") {
      const findings = Array.isArray(carrier.findings) ? carrier.findings : [];
      return this.rollup(findings);
    }
    // The work face reads its DECLARED status. Absent → undefined (no declaration);
    // present-but-invalid → BLOCKED (a declared conclusion that is malformed is a
    // failure signal, never silently approved). This is the ONE ruling for a work
    // status: the reconstruct's work leg delegates here, so the read-back and the
    // judgment-time derivation never disagree.
    const status = carrier.status;
    if (status === undefined) return undefined;
    return status === "APPROVED" || status === "BLOCKED" ? status : "BLOCKED";
  }

  /** The review conclusion rollup — status derived from the findings severities
   *  (the rollup the retired JSON-return channel performed; a review never carries
   *  a child-authored status). */
  rollup(findings: readonly unknown[]): RoundStatus {
    const blockers = findings.filter(
      (finding) => (finding as { severity?: unknown } | null)?.severity === "blocker",
    ).length;
    return blockers > 0 ? "CHANGES_REQUESTED" : findings.length > 0 ? "REVIEW_FIX" : "APPROVED";
  }

  /** The draft findings presented as round findings — unknown severities dropped
   *  (the capsule's blocker count + the outcome's face, never the judgment domain). */
  findingsOf(findings: unknown): readonly RoundFinding[] {
    if (!Array.isArray(findings)) return [];
    const rows: RoundFinding[] = [];
    for (const entry of findings) {
      const severity = (entry as { severity?: unknown } | null)?.severity;
      if (severity !== "blocker" && severity !== "warn" && severity !== "nit") continue;
      const summary = (entry as { summary?: unknown } | null)?.summary;
      rows.push({
        severity: severity as FindingSeverity,
        summary: typeof summary === "string" ? summary : undefined,
      });
    }
    return rows;
  }

  /** The declared schema object of a face — the single-source introspection of this
   *  module's reparametrized `HandoffFamily.schema` value. */
  faceSchema(face: HandoffSchemaFace): SchemaNode {
    return BY_FACE[face];
  }

  /** The draft keys materialize drops — every key the face does not declare as a
   *  child-writable `properties` slot (extra child fields such as a findings-draft
   *  `status`). The read-back validator judges these the same way (drop, never a
   *  BLOCK) — materialize surfaces them as the single §8.7 WARN on the carrier's
   *  notes. A non-object draft drops nothing here (its shape is the validator's
   *  semantic refusal). */
  droppedKeys(face: HandoffSchemaFace, value: unknown): string[] {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
    const declared = new Set(Object.keys(BY_FACE[face].properties ?? {}));
    return Object.keys(value as Record<string, unknown>).filter((key) => !declared.has(key));
  }

  /** Serialize a declared schema object into the prompt's fence — COMPACT (no pretty
   *  indent: the injected text is the per-mode fixed prefix's biggest token cost, and
   *  every dispatch pays it in the child context — minify keeps the round cheap). The
   *  declaration IS the writable plane (no engine-only metadata to strip) — the fence
   *  is the declared node verbatim. */
  #json(node: SchemaNode): string {
    return JSON.stringify(node);
  }

  /** Walk one schema node against a value; every mismatch is a `path: reason`. */
  #check(node: SchemaNode, value: unknown, path: string, problems: SchemaProblem[]): void {
    if (node.enum !== undefined && !node.enum.includes(value)) {
      problems.push({ path, reason: `must be one of ${node.enum.join(" | ")}` });
      return;
    }
    if (node.type !== undefined) {
      if (node.type === "object") {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          problems.push({ path, reason: "expected an object" });
          return;
        }
        const obj = value as Record<string, unknown>;
        for (const key of node.required ?? []) {
          if (obj[key] === undefined)
            problems.push({ path: this.#at(path, key), reason: "required" });
        }
        for (const [key, sub] of Object.entries(node.properties ?? {})) {
          if (obj[key] !== undefined) this.#check(sub, obj[key], this.#at(path, key), problems);
        }
        // Non-declared keys (extra child fields such as a findings-draft
        // `status`) are DROPPED by materialize, never a BLOCK — the validator
        // and materialize judge the same field the same way (§8.7). Only
        // semantic errors on declared fields (required / type / enum / length)
        // refuse the draft.
        return;
      }
      if (node.type === "array") {
        if (!Array.isArray(value)) {
          problems.push({ path, reason: "expected an array" });
          return;
        }
        if (node.items !== undefined) {
          for (let index = 0; index < value.length; index += 1) {
            this.#check(node.items, value[index], `${path}[${index}]`, problems);
          }
        }
        return;
      }
      if (node.type === "string") {
        if (typeof value !== "string") {
          problems.push({ path, reason: "expected a string" });
          return;
        }
        if (node.minLength !== undefined && value.length < node.minLength)
          problems.push({ path, reason: `must be at least ${node.minLength} characters` });
        if (node.maxLength !== undefined && value.length > node.maxLength)
          problems.push({ path, reason: `must be at most ${node.maxLength} characters` });
        return;
      }
      if (node.type === "integer") {
        if (typeof value !== "number" || !Number.isInteger(value)) {
          problems.push({ path, reason: "expected an integer" });
        }
        return;
      }
      if (node.type === "boolean") {
        if (typeof value !== "boolean") problems.push({ path, reason: "expected a boolean" });
        return;
      }
    }
  }

  /** The JSON-path join — `.field` (or bare, at the root). */
  #at(path: string, key: string): string {
    return path.length === 0 ? key : `${path}.${key}`;
  }
}
