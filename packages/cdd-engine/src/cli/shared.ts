// packages/cdd-engine/src/cli/shared.ts — shared host detection + Review Stopping guard cluster
// (multiple consumers reuse). spec §2.6 split: detectCurrentHarness/requireHostHarness/DRY_RUN/
// intTask/resolveTargetDoc/blockerCount/stoppedExit3/reviewStoppingGuard moved out of
// src/cli/review.mjs — ownership decided by closure completeness: reviewStoppingGuard internally
// calls stoppedExit3 + blockerCount + reviewStoppedError (imported from runner/review-loop); the
// three must move together to avoid a shared→review reverse dependency. existingRoundHandoff is
// only consumed by runReview → stays private to review.ts (review.ts runReview still imports
// through this cluster; shared keeps zero reverse dependency).
import type { ArgDef, ArgsDef } from "citty";

import { reviewStoppedError } from "../dispatch/review-loop.ts";
import { exitWithCode } from "../infra/exit.ts";
import { getRoot, resolveDocArg } from "../infra/root.ts";
import { isIncompleteDispatch } from "../rules/failure.ts";

// DRY_RUN — resolution of the program-level `--dry-run` flag (module state). The single write
// entry is setDryRun: the black-box path injects it from bin.ts's preAction over the FULL argv;
// in-process tests (argv not parsed, preAction not fired) inject setDryRun(true) explicitly and
// reset it in a finally. **The engine reads zero env here.**
let dryRun = false;

export const DRY_RUN = (): boolean => dryRun;

export function setDryRun(enabled: boolean): void {
  dryRun = enabled === true;
}

// ---- host harness detection ----

// detect_current_harness: CURSOR_TRACE_ID → cursor-agent; CLAUDE_CODE_SESSION_ID → claude;
// AI_AGENT=claude-code* → claude; otherwise empty. T3 extension: the single host fact source
// (empty → BLOCK). Exported (test seam) — the CLI resolves the harness here and no longer
// accepts a harness flag. The process.env read is the shared-site passthrough anchor
// (scripts/validate residue §2.4.4); requireHostHarness is the CLI-facing seam.
export function detectCurrentHarness(env: NodeJS.ProcessEnv): string {
  if (env.CURSOR_TRACE_ID) return "cursor-agent";
  if (env.CLAUDE_CODE_SESSION_ID) return "claude";
  if ((env.AI_AGENT ?? "").startsWith("claude-code")) return "claude";
  return "";
}

// Host harness gate: the sole harness source for every subcommand action (the CLI resolves it,
// the runner signature is unchanged). Empty host → CDD_BLOCKED + exit 1 — cdd must run from
// inside a supported harness session, and the registry is looked up by that host key.
export function requireHostHarness(): string {
  const harness = detectCurrentHarness(process.env);
  if (!harness) {
    process.stderr.write("CDD_BLOCKED: no host harness detected (run cdd from within a supported harness)\n");
    exitWithCode(1);
  }
  return harness;
}

// ---- review/fix shared helpers ----

// D11 (review/fix shared): reviewed-target resolution + missing-arg guard single point.
// type=spec → --spec (the reviewed doc itself); type=plan → --plan (the reviewed plan, optional
// --spec carries the upstream reference); missing → `cdd <verb> --type <type>:
// missing required --<type> <path>` + exit 2. Shared by the runReview/runFix call sites —
// duplication forbidden. Exit normalizes via resolveDocArg (repo-root-relative → absolute;
// missing → exit 1 three-line diagnostic, §2.4.2) — this is the common `--plan` / `--spec`
// entry for review/fix, one call site covering four read points.
export function resolveTargetDoc(opts: { type: string; spec?: string; plan?: string; root?: string }, verb: string): string {
  const doc = opts.type === "spec" ? opts.spec : opts.plan;
  if (!doc) {
    process.stderr.write(`cdd ${verb} --type ${opts.type}: missing required --${opts.type} <path>\n`);
    exitWithCode(2);
  }
  return resolveDocArg(doc, opts.root ?? getRoot(), opts.type === "spec" ? "spec" : "plan");
}

// Bug A (legacy cdd-task contract): --task must parse as an integer. Rejects NaN at parse
// time (exit 2 + message) instead of letting parseInt leak NaN into runTask and fabricate
// task-NaN-* artifacts with a false APPROVED return block (STD-3).
export function intTask(v: string): number {
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error(`--task must be an integer, got: ${v}`);
  return n;
}

// ---- flag-surface guard (citty Task 9) ----

// Normalize a flag name for comparison: strip dashes / case (--base-branch == -baseBranch).
function normFlag(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

// Unknown-option rejection. citty's parser is tolerant by design (strict:false — unknown flags
// silently land in the parsed values), so a typo like `--taks 1` would otherwise be silently
// ACCEPTED and run a real dispatch. Each action run() pre-scans its raw args against its declared
// arg surface (parse.ts args defs) and throws a CLIError-shaped error (name/code — the bin
// wrapper normalizes it to the resolved command's usage line + exit 2, citty-parse-error parity).
// Program-level flags (`--dry-run` / `--no-dry-run`) are accepted at any position — they are
// declared on the main command only, but the canonical scope is "program" (position-independent).
export function guardArgs(rawArgs: readonly string[], argDef: ArgsDef | undefined): void {
  const declared = new Map<string, ArgDef>();          // normed flag name → its arg definition (canonical key + aliases)
  // The citty `alias` field lives on the string/boolean/enum variants only (PositionalArgDef omits
  // it); the scans below use only non-positional flags, so the access is narrowed via the
  // Partial<Pick<...>> cast — the alias-shaped read is the only surface used here.
  const optionLike = (def: ArgDef): { alias?: string | string[] } => def as { alias?: string | string[] };
  const defs = argDef ?? {};
  for (const key of Object.keys(defs)) {
    declared.set(normFlag(key), defs[key]);
    const aliases = optionLike(defs[key]).alias;
    for (const a of (Array.isArray(aliases) ? aliases : aliases ? [aliases] : [])) {
      declared.set(normFlag(String(a)), defs[key]);
    }
  }
  for (const tok of rawArgs ?? []) {
    if (tok === "--") break;              // everything after -- is positional, not a flag
    if (!tok.startsWith("-")) continue;   // positionals / flag values are not flags themselves
    const name = tok.split("=")[0].replace(/^-+/, "");
    const n = normFlag(name);
    if (n === "dryrun" || n === "nodryrun") continue;                 // program-level option, any position
    // --no-<bool> negation is only meaningful for a boolean-typed declared arg; negating a
    // string/enum arg (e.g. --no-plan) is an unknown option — rejected below.
    if (name.startsWith("no-") && declared.get(normFlag(name.slice(3)))?.type === "boolean") continue;
    if (!declared.has(n)) {
      const err = new Error(`unknown option: ${tok}`) as Error & { name: string; code: string };
      err.name = "CLIError";
      err.code = "E_UNKNOWN_OPTION";
      throw err;
    }
  }
}

export interface PrevHandoff {
  status?: string;
  blocker?: string;
  failure_category?: string;
  findings?: Array<{ severity?: string }>;
}

export function blockerCount(handoff: Pick<PrevHandoff, "findings"> | undefined): number {
  return (handoff?.findings ?? []).filter((f) => f?.severity === "blocker").length;
}

// Review Stopping: reject a re-dispatch of a (type, ref) whose previous round reached
// APPROVED with blocker=0. A failure round (status BLOCKED/TIMEOUT) is NOT "done" — it
// must be re-dispatchable, so the gate requires status === "APPROVED" in addition to
// blockerCount === 0 (SP-4): runner 8.5/8.8/10/10.5 and docs-runner failure paths write
// status:BLOCKED|TIMEOUT with findings:[] → blockerCount alone would misjudge them as passed.
export function stoppedExit3(type: string, round: number, ref: string, blocker: string | undefined, opts?: { reason?: "legacy" | "unchanged" }): never {
  const e = reviewStoppedError(type, round, ref, opts);   // structured error + message, single authority
  process.stderr.write(`${e.message}\n` + (blocker ? `last blocker: ${blocker}\n` : ""));
  exitWithCode(3);
}

// Unified Stopping gate: only APPROVED + blocker=0 stops a re-run; a BLOCKED/TIMEOUT failure
// round (findings:[]) must stay re-dispatchable (SP-4). ref is the type's target signature.
// opts pass through to reviewStoppedError's reason (legacy/unchanged) — task/branch call
// surfaces pass no opts → the default message is unchanged.
// T6 (B3, #250[8]): ENGINE_SELF_WRITTEN / CONTRACT_VIOLATION = this round's dispatch did not
// complete → not a Stopping basis ("counts into Review Stopping = no" control-flow landing).
// The judgment derives from canonical (isIncompleteDispatch) — no hard-coded category name, so
// deleting a canonical category would turn this reference into a red name.
export function reviewStoppingGuard(prev: PrevHandoff | undefined, type: string, round: number, ref: string, opts?: { reason?: "legacy" | "unchanged" }): void {
  const incomplete = isIncompleteDispatch(prev?.failure_category);
  if (!incomplete && prev && prev.status === "APPROVED" && blockerCount(prev) === 0) stoppedExit3(type, round, ref, prev?.blocker, opts);
}