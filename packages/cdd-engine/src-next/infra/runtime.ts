// packages/cdd-engine/src-next/infra/runtime.ts
// T21 — the engine-config typed surface: the engine-config JSON's data-plane home
// as one typed constant module. The new tree reads zero config files — every
// stable runtime fact lives here (or in its single typed home elsewhere in the
// plane) and is imported, never parsed:
//
//   · $version             — the runtime contract version (the face's version pin).
//   · contextContract      — the environment contract's view of the argv channel
//     table (the CLI declaration single surface — face/declare.ts §2.4 — is the
//     channel's home; the runtime references the same table, never a second list).
//   · handoffNamespace     — the workspace-root segment + the handoff family naming
//     table (the ledger's family resolution reads it).
//
// The JSON plane's dead fields are not carried (the delete-dead-empties iron rule):
//   · failureCategories — the new tree keeps no failure-category counter data; the
//     ledger's progress key set is the declared code constant (PROGRESS_COUNTER_ZERO).
//   · handoffNamespace.slugRule — the workspace key is the document's declared
//     `slug:` (judged by the identity index), never a prose data field.
//   · contextContract channels.git / derived / transport / timeouts and the env-host
//     channel — no live consumer; the host-marker closure is single-sourced by the
//     harness detect rows (face/host.ts), never re-declared here.
//
// Module-level exports are types / the declared constant data — zero behavior-
// carrying bare functions (the plan's zero-bare-function discipline).

import { ARGV_CHANNEL, type ChannelArgRow } from "../face/declare.ts";
import { type DocRoots, ENGINE_DOC_ROOTS } from "./doc-roots.ts";

export type { DocRoots } from "./doc-roots.ts";

/** The context contract — the live argv channel table (the single channel the new
 *  tree's command face consumes; the host-marker env closure lives in the harness
 *  detect rows, face/host.ts — never duplicated here). */
export interface ContextContract {
  readonly channels: Readonly<{ argv: Readonly<Record<string, ChannelArgRow>> }>;
}

/** One handoff-family record — the canonical file-name pattern. `name` is the whole
 *  naming truth (ledger/lifecycle resolve the file name from it; the carrier plane is
 *  DERIVED from the op by the session plane's `planeOf` — never declared per family).
 *  The retired round-policy / phase / fix-family / fix-template / prev-derivation
 *  fields (zero readers — spec §3.4 ⑯) are deleted, never left as dead declarations. */
export interface HandoffFamily {
  /** The canonical file name — the `{placeholder}` pattern the ledger fills. */
  name: string;
}

/** The handoff-name space — the workspace segment + the family naming table. */
export interface HandoffNamespace {
  /** The repo-scoped workspace segment (`.kairos/cdd` — WorkspaceRoot joins it). */
  workspaceRoot: string;
  /** The handoff families keyed by `op.type` — the ledger's naming truth. */
  families: Readonly<Record<string, HandoffFamily>>;
}

/** The engine runtime — the typed engine-config surface (version + channels + names
 *  + doc roots). */
export interface EngineRuntime {
  /** The runtime contract version. */
  $version: number;
  /** The context contract — the live argv channel table. */
  contextContract: ContextContract;
  /** The handoff-name space — workspace + family naming. */
  handoffNamespace: HandoffNamespace;
  /** The doc-tree root segments (the slug → node-tree face's file-system truth). */
  docRoots: DocRoots;
}

/** The handoff family naming table — the canonical per-family file-name patterns
 *  keyed by `op.type` (implement.wave / review.wave / … — the ledger's single
 *  naming truth, verbatim from the engine-config handoff namespace). The v1.9
 *  reparametrization: `returnFormat` is gone (RETURN_PROSE is the one return
 *  contract) and each family is a pure name row — the carrier plane derives from the
 *  op, never from this table (`planeOf`, session plane). */
export const HANDOFF_FAMILIES = {
  "implement.wave": {
    name: "tasks-{tasks}-implement.json",
  },
  "review.wave": {
    name: "tasks-{tasks}-review-{round}.json",
  },
  "fix.wave": {
    name: "tasks-{tasks}-fix-{round}.json",
  },
  "review.spec": {
    name: "spec-review-{round}.json",
  },
  "fix.spec": {
    name: "spec-fix-{round}.json",
  },
  "review.plan": {
    name: "plan-review-{round}.json",
  },
  "fix.plan": {
    name: "plan-fix-{round}.json",
  },
  "review.branch": {
    // find #9 (spec §6.5): the range token leaves the file name — the workspace
    // slug is the plan-slug (the fix face carries --plan) · round accumulates
    // across re-reviews (lineKey pins "branch").
    name: "branch-review-{round}.json",
  },
  "fix.branch": {
    name: "branch-fix-{round}.json",
  },
} as const satisfies Readonly<Record<string, HandoffFamily>>;

/** The engine runtime — the typed engine-config surface, one constant (the argv
 *  channel table is the CLI declaration single surface, face/declare.ts §2.4 —
 *  referenced here, never re-declared). */
export const ENGINE_RUNTIME = {
  $version: 1,
  contextContract: { channels: { argv: ARGV_CHANNEL } },
  handoffNamespace: {
    workspaceRoot: ".kairos/cdd",
    families: HANDOFF_FAMILIES,
  },
  docRoots: ENGINE_DOC_ROOTS,
} as const satisfies EngineRuntime;
