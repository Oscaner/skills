// packages/cdd-engine/src-next/infra/runtime.ts
// T21 — the engine-config typed surface: the engine-config JSON's data-plane home
// as one typed constant module. The new tree reads zero config files — every
// stable runtime fact lives here (or in its single typed home elsewhere in the
// plane) and is imported, never parsed:
//
//   · $version              — the runtime contract version (the face's version pin).
//   · contextContract       — the argv channel table: the CLI flag/type/enum single
//     source (the command registry's keys resolve through it, never a second list).
//   · handoffNamespace      — the workspace-root segment + the handoff family naming
//     table (the ledger's family resolution reads it).
//
// The JSON plane's dead fields are not carried (the delete-dead-empties iron rule):
//   · failureCategories — the new tree keeps no failure-category counter data; the
//     ledger's progress key set is the declared code constant (PROGRESS_COUNTER_ZERO).
//   · handoffNamespace.slugRule — the slug derivation is code (Workspace.slugFromDoc),
//     never a prose data field.
//   · contextContract channels.git / derived / transport / timeouts and the env-host
//     channel — no live consumer; the host-marker closure is single-sourced by the
//     harness detect rows (face/host.ts), never re-declared here.
//
// Module-level exports are types / the declared constant data — zero behavior-
// carrying bare functions (the plan's zero-bare-function discipline).

/** The component-value types of the argv channel (the CLI parse validates by these). */
export type ChannelValueType = "string" | "path" | "int-list" | "enum" | "sha" | "int" | "bool";

/** One argv-channel row — the flag/type/enum declaration of one CLI key. */
export interface ChannelArgRow {
  /** The `--flag` spelling. */
  flag: string;
  /** The complement alias (help's `-h`), when the channel declares one. */
  alias?: string;
  /** The component-value type the CLI parse validates by. */
  type: ChannelValueType;
  /** The enum domain, when the type is enum. */
  values?: readonly string[];
  /** The program-scope marker (dry-run/help — accepted at any position). */
  scope?: "program";
}

/** The argv channel — the CLI's flag/type/values single source. */
export interface ArgvChannel {
  readonly argv: Readonly<Record<string, ChannelArgRow>>;
}

/** The context contract — the live argv channel table (the single channel the new
 *  tree's command face consumes; the host-marker env closure lives in the harness
 *  detect rows, face/host.ts — never duplicated here). */
export interface ContextContract {
  readonly channels: Readonly<{ argv: Readonly<Record<string, ChannelArgRow>> }>;
}

/** One handoff-family record — the canonical file-name pattern + round policy + the
 *  carrier's schema face (the full family row the JSON plane carried — status /
 *  schema / fixFamily / prev are data the typed plane preserves). The v1.9 contract
 *  reparametrization: `returnFormat` is deleted (RETURN_STDOUT_BLOCK is the ONE
 *  return contract — the per-family field was the JSON/block selector, retired with
 *  the divided return faces) and the dead `schema` field is resurrected as the
 *  handoff-schema face selector (`work` — implement/fix carrier — vs `findings` —
 *  the review carrier, session/handoff-schema.ts). */
export interface HandoffFamily {
  /** The canonical file name — the `{placeholder}` pattern the ledger fills. */
  name: string;
  /** The family's round policy (fixed / increment / source). */
  round?: "fixed" | "increment" | "source";
  /** The dispatch phase the family carries (implement/review/fix/branch-review). */
  phase?: string;
  /** The carrier status policy (contract / rollup). */
  status?: "contract" | "rollup";
  /** The carrier schema face (work / findings) — the handoff-schema selector (§3.6:
   *  the field resurrected from the dead task/docs discrimination; the docs-fix
   *  families (fix.spec / fix.plan) ride the findings face — §3.6's per-mode split:
   *  implement/fix → work + evidence · review/docs-fix → findings). */
  schema?: "work" | "findings";
  /** The fix-round family of a review family. */
  fixFamily?: string;
  /** The fix-template face of a fix family. */
  fixTemplate?: string;
  /** The previous-round family derivation of increment/source families. */
  prev?: Readonly<Record<string, string>>;
}

/** The handoff-name space — the workspace segment + the family naming table. */
export interface HandoffNamespace {
  /** The repo-scoped workspace segment (`.kairos/cdd` — WorkspaceRoot joins it). */
  workspaceRoot: string;
  /** The handoff families keyed by `op.type` — the ledger's naming truth. */
  families: Readonly<Record<string, HandoffFamily>>;
}

/** The engine runtime — the typed engine-config surface (version + channels + names). */
export interface EngineRuntime {
  /** The runtime contract version. */
  $version: number;
  /** The context contract — the live argv channel table. */
  contextContract: ContextContract;
  /** The handoff-name space — workspace + family naming. */
  handoffNamespace: HandoffNamespace;
}

/** The argv channel table — the CLI flag/type/enum single source (the engine-config
 *  argv channel verbatim: flag spellings, value types and enum domains ride these
 *  rows, and the command registry + the channel audit read them from here). */
export const ARGV_CHANNEL = {
  plan: { flag: "--plan", type: "path" },
  spec: { flag: "--spec", type: "path" },
  findings: { flag: "--findings", type: "path" },
  tasks: { flag: "--tasks", type: "int-list" },
  type: {
    flag: "--type",
    type: "enum",
    values: ["wave", "branch", "spec", "plan"],
  },
  base: { flag: "--base", type: "sha" },
  head: { flag: "--head", type: "sha" },
  round: { flag: "--round", type: "int" },
  source: {
    flag: "--source",
    type: "enum",
    values: ["plan-field", "branch-upstream", "conversation-context", "user-confirmed"],
  },
  force: { flag: "--force", type: "bool" },
  dryRun: { flag: "--dry-run", type: "bool", scope: "program" },
  help: { flag: "--help", alias: "-h", type: "bool", scope: "program" },
  root: { flag: "--root", type: "path" },
} as const satisfies Readonly<Record<string, ChannelArgRow>>;

/** The handoff family naming table — the canonical per-family file-name patterns
 *  keyed by `op.type` (implement.wave / review.wave / … — the ledger's single
 *  naming truth, verbatim from the engine-config handoff namespace). The v1.9
 *  reparametrization: `returnFormat` is gone (RETURN_STDOUT_BLOCK is the one return
 *  contract) and the `schema` faces are the handoff-schema selector (work / findings —
 *  §3.6, session/handoff-schema.ts). */
export const HANDOFF_FAMILIES = {
  "implement.wave": {
    name: "tasks-{tasks}-implement.json",
    round: "fixed",
    status: "contract",
    schema: "work",
    phase: "implement",
  },
  "review.wave": {
    name: "tasks-{tasks}-review-{round}.json",
    round: "increment",
    status: "rollup",
    schema: "findings",
    phase: "review",
    fixFamily: "fix.wave",
    prev: { round1: "implement.wave", roundR: "fix.task:R-1" },
  },
  "fix.wave": {
    name: "tasks-{tasks}-fix-{round}.json",
    round: "source",
    status: "contract",
    schema: "work",
    fixTemplate: "fix",
    phase: "fix",
    prev: { roundR: "review.task:R" },
  },
  "review.spec": {
    name: "spec-review-{round}.json",
    round: "increment",
    status: "rollup",
    schema: "findings",
    phase: "review",
    fixFamily: "fix.spec",
  },
  "fix.spec": {
    name: "spec-fix-{round}.json",
    round: "source",
    status: "contract",
    schema: "findings",
    fixTemplate: "docs",
    phase: "fix",
    prev: { roundR: "review.spec:R" },
  },
  "review.plan": {
    name: "plan-review-{round}.json",
    round: "increment",
    status: "rollup",
    schema: "findings",
    phase: "review",
    fixFamily: "fix.plan",
  },
  "fix.plan": {
    name: "plan-fix-{round}.json",
    round: "source",
    status: "contract",
    schema: "findings",
    fixTemplate: "docs",
    phase: "fix",
    prev: { roundR: "review.plan:R" },
  },
  "review.branch": {
    name: "branch-review-{base7}..{head7}-r{round}.json",
    round: "increment",
    status: "rollup",
    schema: "findings",
    phase: "branch-review",
  },
  "fix.branch": {
    name: "branch-fix-{base7}..{head7}-r{round}.json",
    round: "source",
    status: "contract",
    schema: "work",
    fixTemplate: "fix",
    phase: "fix",
    prev: { roundR: "review.branch:R" },
  },
} as const satisfies Readonly<Record<string, HandoffFamily>>;

/** The engine runtime — the typed engine-config surface, one constant. */
export const ENGINE_RUNTIME = {
  $version: 1,
  contextContract: { channels: { argv: ARGV_CHANNEL } },
  handoffNamespace: {
    workspaceRoot: ".kairos/cdd",
    families: HANDOFF_FAMILIES,
  },
} as const satisfies EngineRuntime;
