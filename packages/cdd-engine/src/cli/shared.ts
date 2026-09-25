// packages/cdd-engine/src/cli/shared.ts — shared host detection + Review Convergence guard cluster
// (multiple consumers reuse). spec §2.6 split: detectCurrentHarness/requireHostHarness/DRY_RUN/
// parseTaskList/resolveTargetDoc/blockerCount/convergedExit3/reviewConvergenceGuard moved out of
// src/cli/review.mjs — ownership decided by closure completeness: reviewConvergenceGuard internally
// calls convergedExit3 + blockerCount + reviewConvergedError (since P6 T24 the cluster re-exports
// from rules/convergence.ts, its single owner — spec T7.3 C; see the bottom-of-file re-export
// block). existingRoundHandoff is only consumed by runReview → stays private to review.ts
// (review.ts runReview still imports through this cluster; shared keeps zero reverse dependency).
import type { ArgDef, ArgsDef } from "citty";
import { IllegalTaskTokenError, TaskGroup } from "../domain/task-group.ts";
import { cliUsageError, exitWithCode } from "../infra/exit.ts";
import { getRoot, resolveDocArg } from "../infra/root.ts";

// DRY_RUN — the program-level `--dry-run` flag, owned by the CddRuntime singleton (P4.4 Task 4:
// the former module-level `let dryRun` migrated into infra/runtime.ts — the class is the single
// mutable-state surface). The single write entry stays setDryRun: the black-box path injects it
// from bin.ts's preAction over the FULL argv; in-process tests inject setDryRun(true) explicitly
// and reset it in a finally. **The engine reads zero env here.** These two are re-exported from the
// runtime module (same identities — the cli face keeps zero state of its own).
export { DRY_RUN, setDryRun } from "../infra/runtime.ts";

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
    process.stderr.write(
      "CDD_BLOCKED: no host harness detected (run cdd from within a supported harness)\n",
    );
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
export function resolveTargetDoc(
  opts: { type: string; spec?: string; plan?: string; root?: string },
  verb: string,
): string {
  const doc = opts.type === "spec" ? opts.spec : opts.plan;
  if (!doc) {
    process.stderr.write(
      `cdd ${verb} --type ${opts.type}: missing required --${opts.type} <path>\n`,
    );
    exitWithCode(2);
  }
  return resolveDocArg(doc, opts.root ?? getRoot(), opts.type === "spec" ? "spec" : "plan");
}

// Bug A (legacy cdd-task contract) under the P4.3 --tasks list model: the value must parse as
// comma-separated integers. Token validation migrates to the TaskGroup value object (the group
// identity's single factory — fromTokens: per-token integer validation · dedupe · ascending sort;
// P4.4 Task 3): the hyphen form `1-2` and any non-integer token throw IllegalTaskTokenError, which
// this boundary translates to the exit-2 usage face (`--tasks must be comma-separated integers:
// <token>`) — never a parse-error that fabricates a `task-NaN-*` artifact with a false APPROVED
// return block (STD-3). Empty slices (a trailing comma in `1,`) are rejected; tokens are trimmed.
// The legacy single-value intTask entry is retired — the CLI task surface is list-shaped only, and
// the GROUP is the dispatch unit: parseTaskList returns the canonical TaskGroup (single-data-model)
// and dispatch call sites thread the whole group — no per-task iteration exists.
export function parseTaskList(v: string): TaskGroup {
  try {
    return TaskGroup.fromTokens(v.split(","));
  } catch (e) {
    if (e instanceof IllegalTaskTokenError) {
      throw cliUsageError(`--tasks must be comma-separated integers: ${e.token}`);
    }
    throw e;
  }
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
  const declared = new Map<string, ArgDef>(); // normed flag name → its arg definition (canonical key + aliases)
  // The citty `alias` field lives on the string/boolean/enum variants only (PositionalArgDef omits
  // it); the scans below use only non-positional flags, so the access is narrowed via the
  // Partial<Pick<...>> cast — the alias-shaped read is the only surface used here.
  const optionLike = (def: ArgDef): { alias?: string | string[] } =>
    def as { alias?: string | string[] };
  const defs = argDef ?? {};
  for (const key of Object.keys(defs)) {
    declared.set(normFlag(key), defs[key]);
    const aliases = optionLike(defs[key]).alias;
    for (const a of Array.isArray(aliases) ? aliases : aliases ? [aliases] : []) {
      declared.set(normFlag(String(a)), defs[key]);
    }
  }
  for (const tok of rawArgs ?? []) {
    if (tok === "--") break; // everything after -- is positional, not a flag
    if (!tok.startsWith("-")) continue; // positionals / flag values are not flags themselves
    const name = tok.split("=")[0].replace(/^-+/, "");
    const n = normFlag(name);
    if (n === "dryrun" || n === "nodryrun") continue; // program-level option, any position
    // --no-<bool> negation is only meaningful for a boolean-typed declared arg; negating a
    // string/enum arg (e.g. --no-plan) is an unknown option — rejected below.
    if (name.startsWith("no-") && declared.get(normFlag(name.slice(3)))?.type === "boolean")
      continue;
    if (!declared.has(n)) {
      throw cliUsageError(`unknown option: ${tok}`);
    }
  }
}

// ---- Review Convergence — single owner, re-exported (P6 T24 C) ----
// The Convergence cluster (blockerCount / reviewConvergedError / convergedExit3 /
// reviewConvergenceGuard) has ONE owner: src/rules/convergence.ts (pure judgment layer — the
// correct layer per the infra→rules→artifacts→dispatch→cli boundary). The cli face keeps no
// second definition: these four functions are re-exports, byte-identical with the owner —
// a Convergence behavior change edits rules/convergence.ts once.
export {
  blockerCount,
  convergedExit3,
  reviewConvergedError,
  reviewConvergenceGuard,
} from "../rules/convergence.ts";
/** Review-handoff shape the CLI guard takes (alias of the owner's HandoffLike — one type
 * identity, never a second declaration). */
export type PrevHandoff = import("../rules/convergence.ts").HandoffLike;
