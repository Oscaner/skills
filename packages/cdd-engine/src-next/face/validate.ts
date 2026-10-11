// packages/cdd-engine/src-next/face/validate.ts
// T2 — the domain-semantics validators commander does not carry (spec §4): the
// value-domain checks (enum · int-list · 8-char sha · integer), the schema
// <type> vocabulary, and the conditional required groups. The semantics are
// ported from the argv parse channel's #validate/#positionalsOf faces
// (face/argv.ts) and stay componentized here when the parse channel is deleted
// (T7); the T4 composition root wires them into the .action thin shells and
// normalizes every isUsage-marked rejection to exit 2.
//
// Module-level exports are types / constant data — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import type { DocKey } from "../contract/project.ts";

/** The schema `<type>` vocabulary — the get and gen leaves' ONE shared table
 *  (one table, two faces, spec §5.3): the primary DocKey spellings (overall |
 *  plan | phase-spec) plus the legacy `phaseSpec` alias row normalized to the
 *  kebab key. Ported from argv.ts SCHEMA_TYPE_KEYS (the parse channel's copy is
 *  deleted with argv.ts at T7) — typeKey validates the primary spellings; the
 *  phaseSpec alias row and the plan-graph route are the T4 thin shell's steps. */
const SCHEMA_TYPE_KEYS: Record<string, DocKey> = {
  overall: "overall",
  plan: "plan",
  "phase-spec": "phase-spec",
  phaseSpec: "phase-spec",
};

/** The primary spellings — the self-mapping rows — derived from the one table
 *  (never a hand-written second list): the typeKey error message's value list. */
const SCHEMA_PRIMARY_KEYS: readonly string[] = Object.keys(SCHEMA_TYPE_KEYS).filter(
  (key) => SCHEMA_TYPE_KEYS[key] === key,
);

/** The review/fix branch ref faces — the source review range declared at ONE
 *  surface per verb: `--base + --head` (the range's birth face) · `--findings`
 *  (the fix handoff carrier; fix registers no --base/--head). */
const BRANCH_REVIEW_GROUP = ["--base", "--head"] as const;
const BRANCH_FIX_GROUP = ["--findings"] as const;

/** The conditional required group per target type (wave/spec/plan) — the
 *  #sceneOf required faces, replicated without mutual-exclusion rejections. */
const REQUIRED_GROUPS: Record<string, readonly string[]> = {
  wave: ["--plan"],
  spec: ["--spec"],
  plan: ["--plan"],
};

/** The usage-domain error of the validator — the T4 adapter layer normalizes
 *  every isUsage-marked rejection to exit 2 (the steady usage row of the
 *  exit-code table). */
export class ValidatorUsageError extends Error {
  readonly isUsage = true;

  constructor(message: string) {
    super(message);
    this.name = "ValidatorUsageError";
  }
}

/** ValueValidator — the domain-semantics validators commander does not carry.
 *  Every rejection is a usage-domain error (isUsage) — the value-domain and
 *  vocabulary message bytes are engine-held (spec §4/§7.3). */
export class ValueValidator {
  /** The enum-domain check — raw must be one of the declared values. */
  enum(values: readonly string[], raw: string): string {
    if (!values.includes(raw)) {
      throw new ValidatorUsageError(`must be one of ${values.join(" | ")}`);
    }
    return raw;
  }

  /** The int-list check — `n|n,n,…`, normalized to the sorted deduped comma
   *  string the run face's #tasksOf consumes verbatim (`[...new Set()]`
   *  `.sort().join(",")` — zero rewriting of the consumed shape); a non-integer
   *  token is a usage error. */
  intList(raw: string): string {
    const parts = raw.split(",").map((part) => part.trim());
    const invalid = parts.find((part) => !/^\d+$/.test(part));
    if (invalid !== undefined) {
      throw new ValidatorUsageError(`must be comma-separated integers: ${invalid}`);
    }
    return [...new Set(parts.map(Number))].sort((a, b) => a - b).join(",");
  }

  /** The 8-char sha check — exactly 8 hex digits (the short form of the CLI's
   *  only sha face). */
  sha8(raw: string): string {
    if (!/^[0-9a-f]{8}$/.test(raw)) {
      throw new ValidatorUsageError("must be an 8-char sha");
    }
    return raw;
  }

  /** The integer check — a non-negative decimal integer (the round/tasks face). */
  int(raw: string): number {
    if (!/^\d+$/.test(raw)) {
      throw new ValidatorUsageError("must be an integer");
    }
    return Number(raw);
  }

  /** The schema `<type>` vocabulary check — the primary spellings only. Every
   *  primary spelling normalizes to itself; the phaseSpec alias row normalizes
   *  away from the raw form, so a non-primary spelling rejects here — the T4
   *  thin shell applies the alias row (and the plan-graph route) before this
   *  vocabulary check. An out-of-vocabulary type never falls through as a
   *  silent `undefined` (the schema get/gen routing guard). */
  typeKey(raw: string): string {
    if (SCHEMA_TYPE_KEYS[raw] !== raw) {
      throw new ValidatorUsageError(
        `unknown schema type: ${raw} (available: ${SCHEMA_PRIMARY_KEYS.join(", ")})`,
      );
    }
    return raw;
  }

  /** The conditional required groups — replicated from the #sceneOf faces
   *  (review/fix), keyed by `--type`, never a mutual-exclusion rejection (both
   *  `--plan` and `--spec` stay acceptable together, as today). `declared` is
   *  the set of flags present on the command line. branch's ref face resolves
   *  by the fix `--findings` carrier presence (the only reachable selector —
   *  fix registers no --base/--head and review registers no --findings). */
  distribution(type: string, declared: ReadonlySet<string>): void {
    const group =
      type === "branch"
        ? declared.has("--findings")
          ? BRANCH_FIX_GROUP
          : BRANCH_REVIEW_GROUP
        : REQUIRED_GROUPS[type];
    if (group === undefined) {
      throw new ValidatorUsageError(`--type ${type}: unknown type — no required group`);
    }
    const missing = group.filter((flag) => !declared.has(flag));
    if (missing.length > 0) {
      throw new ValidatorUsageError(`missing required ${missing.join(" ")}`);
    }
  }
}
