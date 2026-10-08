// packages/cdd-engine/src-next/session/handoff-schema.ts
// T15 v1.9 — the handoff schema face (design spec §3.6): the child's writable handoff
// contract as ONE typed declaration with TWO projections. The old-tree handoff schema
// was a config/schema JSON file loaded by Ajv and injected via
// renderHandoffSchemaJson; the cutover deleted both, and the v1.7 三连裁定 re-seats
// the structural constraint as a typed declaration living in this module — zero
// config/schema/*.json files, one source, two consumers:
//
//   · projections: ① the prompt-injection text (schemaText — the ```json fences
//     byte-fixed per face, so the fixed prefix tail of the dispatch prompt stays
//     cache-friendly) and ② the engine read-back validator (violations /
//     evidenceViolations — the child draft is validated against exactly the same
//     declared objects the prompt showed it).
//   · faces: the per-family `schema` field of the handoff families (infra/runtime.ts)
//     selects the face — `work` (implement/fix: status+artifacts+commits+changes,
//     plus the separate test-evidence file for task-family rounds) or `findings`
//     (reviews: findings-only carrier — the engine rolls the status up from the
//     findings, never a child-authored status).
//
// The validator is a purpose-built walker over the declared schema objects (the
// keywords this contract uses — type / properties / required / items / enum /
// minLength / maxLength / additionalProperties) — the new tree reads zero config
// files and takes no Ajv dependency; a wrong-shape child draft is the engine's
// read-back BLOCK, and the same declared objects drive both projections so the
// prompt can never show a schema the engine does not enforce.
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
  additionalProperties?: boolean | SchemaNode;
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
  additionalProperties: true,
};

/** One commit-range row — the work carrier's commits (both ends full 40-char shas). */
const COMMITS: SchemaNode = {
  type: "object",
  required: ["base", "head"],
  properties: {
    base: { type: "string", minLength: 40, maxLength: 40 },
    head: { type: "string", minLength: 40, maxLength: 40 },
  },
  additionalProperties: false,
};

/** One changed-file row of the `changes[]` ledger (file required, reason optional). */
const CHANGED_FILE: SchemaNode = {
  type: "object",
  required: ["file"],
  properties: {
    file: { type: "string" },
    reason: { type: "string" },
  },
  additionalProperties: true,
};

/** The `work` writable subset — implement/fix carrier. `status` and `artifacts` are
 *  the round's required core; commits / changes[] / notes ride the declared optional
 *  fields. Reserved fields (phase · tasks) are NOT declared → additionalProperties
 *  false refuses them, so the engine stays the carrier's single author. */
const CARRIER_WORK: SchemaNode = {
  type: "object",
  required: ["status", "artifacts"],
  properties: {
    status: { type: "string", enum: ["APPROVED", "BLOCKED"] },
    failure_category: { type: "string" },
    artifacts: { type: "object", additionalProperties: { type: "string" } },
    commits: COMMITS,
    changes: { type: "array", items: CHANGED_FILE },
    notes: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
};

/** The `findings` writable subset — review + docs-fix carrier. NO status (the engine
 *  rolls the conclusion up from the findings). The optional commits row rides the
 *  docs-fix rounds (the fix commits its doc edit — the re-review's base derives from
 *  it); a review never writes one. */
const CARRIER_FINDINGS: SchemaNode = {
  type: "object",
  required: ["findings"],
  properties: {
    findings: { type: "array", items: FINDING },
    artifacts: { type: "object", additionalProperties: { type: "string" } },
    commits: COMMITS,
    notes: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
};

/** The test-evidence file schema — the evidence gate's engine read-back contract
 *  (the second散文虚设补钉: the old prompt claimed an engine read-back the engine
 *  never performed; now both projections are real). A task-family work round missing
 *  or violating this file rewrites the round to BLOCKED. */
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
      additionalProperties: true,
    },
    behavior_change: { type: "boolean" },
  },
  additionalProperties: true,
};

/** The face → declared writable-subset table (the single source both projections read). */
const BY_FACE: Readonly<Record<HandoffSchemaFace, SchemaNode>> = {
  work: CARRIER_WORK,
  findings: CARRIER_FINDINGS,
};

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
   *  subset in a ```json fence + (task-family work rounds) the evidence file's
   *  schema in a second fence. The text is byte-stable per (face, evidence) —
   *  the fixed bytes of the dispatch prompt's contract surface. */
  schemaText(face: HandoffSchemaFace, evidence: boolean): string {
    const carrier = this.#json(BY_FACE[face]);
    let text = `\`OUTPUT_HANDOFF\` is this round's child-authored draft — write it per this writable subset. The engine validates the draft against exactly this schema after you exit, then materializes the final carrier in place; engine-reserved fields are not listed here and must not be written.\n\n\`\`\`json\n${carrier}\n\`\`\``;
    if (evidence) {
      text += `\n\nWrite the test-evidence file (\`tasks-{SCOPE}-test-evidence.json\` under \`WORKSPACE_DIR\`) per this schema — the engine reads it back with the same stakes:\n\n\`\`\`json\n${this.#json(EVIDENCE)}\n\`\`\``;
    }
    return text;
  }

  /** The declared evidence schema, as text (the evidence-gate prompt's shared fence). */
  evidenceSchemaText(): string {
    return this.#json(EVIDENCE);
  }

  /** Projection ② — validate a child draft against a face's writable subset. Every
   *  problem is a read-back BLOCK; the draft is left untouched for the child's
   *  resume (不覆盖 — the engine never clobbers a child's work). */
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

  /** The review conclusion rollup — status derived from the findings severities
   *  (the rollup the old RETURN_JSON face performed; a review never carries a
   *  child-authored status). */
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

  /** Serialize a declared schema object into the prompt's JSON fence (no $schema
   *  meta-key — the writable-subset projection, never the meta-plane). */
  #json(node: SchemaNode): string {
    return JSON.stringify(node, null, 2);
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
        const additional = node.additionalProperties ?? true;
        if (additional === false) {
          for (const key of Object.keys(obj)) {
            if (!(key in (node.properties ?? {})))
              problems.push({ path: this.#at(path, key), reason: "not a declared field" });
          }
        }
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
