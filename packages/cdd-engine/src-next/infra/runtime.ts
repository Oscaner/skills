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
//   · handoffNamespace     — the workspace-root segment + the handoff family key set
//     (the ledger's unknown-family check reads it; the file names are the session
//     plane's ONE mint, never a table here).
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

/** One handoff family — an `op.type` key the ledger resolves. The family surface is a
 *  KEY SET, never a second naming: every file name is the one mint the session plane's
 *  `RoundNaming#renderName` owns, so no family row spells a `{placeholder}` pattern
 *  (the retired shapes — the cycle-less implement draft, the attempt-free review name —
 *  would be a second truth the renderer can no longer produce). */
export type HandoffFamily = (typeof HANDOFF_FAMILIES)[number];

/** The handoff families the ledger resolves — the loud unknown-family key set, keyed by
 *  `op.type` (implement.wave · review.wave · …). */
export const HANDOFF_FAMILIES = [
  "implement.wave",
  "review.wave",
  "fix.wave",
  "review.phase-spec",
  "fix.phase-spec",
  "review.overall",
  "fix.overall",
  "review.plan",
  "fix.plan",
  "review.single-spec",
  "fix.single-spec",
  "review.branch",
  "fix.branch",
] as const;

/** The handoff-name space — the workspace segment + the family key set. */
export interface HandoffNamespace {
  /** The repo-scoped workspace segment (`.kairos/cdd` — WorkspaceRoot joins it). */
  workspaceRoot: string;
  /** The `op.type` families the ledger resolves — a key set, never a naming table. */
  families: readonly HandoffFamily[];
}

/** The engine runtime — the typed engine-config surface (version + channels + names
 *  + doc roots). */
export interface EngineRuntime {
  /** The runtime contract version. */
  $version: number;
  /** The context contract — the live argv channel table. */
  contextContract: ContextContract;
  /** The handoff-name space — workspace + family key set. */
  handoffNamespace: HandoffNamespace;
  /** The doc-tree root segments (the slug → node-tree face's file-system truth). */
  docRoots: DocRoots;
}

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
