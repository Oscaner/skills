// packages/cdd-engine/src/artifacts/handoff/finalize.ts — handoff carrier finalization single point
// (T7; Task 8 TS port of finalize.mjs): agent content → finalized handoff → full-replace write →
// return block re-emit. Peer of handoff/naming (finalization is an independent concern).
// Task 23: ① three-surface orthogonalization — status (round conclusion) vs failure_category
// (mechanism channel) vs unverifiable[]/plan_conflicts[] (content notes) never fold: the derived
// BLOCKED lane carries blockedCarrierFor (category + real blocker). ③ statusExitCode maps the
// round conclusion to the runner exit (BLOCKED → 1 on any channel). ④ the materialized return
// blocker stays real-only (returnBlocker; no fabricated default). ⑤ return-block naming.
// Architecture: the engine is the carrier's single author (T5/T6/T7 unified); the agent only
// contributes content slices (findings/blocker/artifacts/notes).
// Dispatch per canonical family `status` rule (plan-constraints「status 单一权威」):
//   review.* → rollup derivation (applyDerivedStatus; SP-4 failure rounds exempt);
//   implement → materialization (no agentHandoff input slot — residue has no attachment channel;
//     T6 materialization logic moved into this module);
//   fix       → work-type: agent-declared status kept, vetoed by the commit-contract layer.
// No residue-compat layer: no maintenance logic for the "agent writes a partial handoff" path
// that cannot exist under the correct model (runner 8.8's implement gate + writeOwnHandoff
// full-replace structurally eliminate it).
// contract.mjs symbol split (spec §2.3): the five status-derivation symbols (normalizeHandoffStatus /
// classifySeverity / rollupStatus / deriveReviewStatus / applyDerivedStatus) merged into this file
// (formerly the severity-contract cluster, spec D1/D4/D5a; applyDerivedStatus was itself a
// finalize consumer, cohesive in the same cluster).
// Task 5 bottom-swap: git judgment via infra/git.ts (simple-git single point). Task 8: write-side
// reads come from ./write.ts.
// Import note (write-side same-source): implement materialization's carrier key set passes
// normalizeHandoff (rules/schema.ts) — a deliberate mutual import with schema.ts (schema.ts uses
// this file's rollupStatus to fill review-family status); both directions are function
// declarations reading no module-level bindings of the other, so either evaluation order is safe.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { gitRevParseHead } from "../../infra/git.ts";
import { readJson, writeOwnHandoff } from "./write.ts";
import { normalizeHandoff } from "../../rules/schema.ts";
import { FAILURE_CATEGORIES } from "../../rules/failure.ts";

// ---- severity contract / status derivation (merged from contract.mjs, spec §2.3) ----

/** handoff status normalization (T2: runner.mjs validator normalization):
 * DONE/OK/COMPLETED → APPROVED; everything else unchanged (UNKNOWN/MISSING/CHANGES_REQUESTED/
 * BLOCKED keep their behavior). */
export function normalizeHandoffStatus(status: string | undefined): string | undefined {
  switch (status) {
    case "DONE":
    case "OK":
    case "COMPLETED":
      return "APPROVED";
    default:
      return status;
  }
}

/** severity → decision. Contract-pinned (spec D1/D4/D5a):
 *   "blocker" → "CHANGES_REQUESTED"; "warn"|"nit" → "APPROVED" (warn/nit likewise fully enter the
 *   fix loop);
 *   "unverifiable" / "needs_context" → "STOP" (BLOCKED). Unknown → throw (contract violation). */
export function classifySeverity(sev: unknown): string {
  const s = String(sev).toLowerCase().replaceAll("-", "_");
  switch (s) {
    case "blocker":
      return "CHANGES_REQUESTED";
    case "warn":
    case "nit":
      return "APPROVED";
    case "unverifiable":
    case "needs_context":
      return "STOP";
    default:
      throw new Error(`unknown severity: ${String(sev)}`);
  }
}

/** findings[] roll-up → handoff status (aligned with the status enum of
 * packages/cdd-engine/templates/schema/docs-handoff-schema.json; this rollup is the mapping):
 *   empty → APPROVED; warn/nit only → APPROVED; blocker present → CHANGES_REQUESTED;
 *   non-empty unverifiable[] / plan_conflicts[] → BLOCKED. */
export function rollupStatus(
  findings: Array<{ severity?: string }> = [],
  unverifiable: unknown[] = [],
  planConflicts: unknown[] = [],
): string {
  if (unverifiable.length > 0 || planConflicts.length > 0) return "BLOCKED";
  const hasBlocker = findings.some((f) => f?.severity === "blocker");
  return hasBlocker ? "CHANGES_REQUESTED" : "APPROVED";
}

/** review-family handoff status derivation (engine-authoritative only): after schema validation,
 * findings roll-up overwrites the agent-declared status.
 * SP-4 exemption: failure rounds (engine-written BLOCKED/TIMEOUT, agent status ∈
 * {BLOCKED, TIMEOUT}) are not overwritten.
 * Rollup triggers only when findings.length > 0; with empty findings CHANGES_REQUESTED (0
 * blockers) → APPROVED, APPROVED empty-load stays, default → APPROVED.
 * BRANCH NIT⑥: consult plan_conflicts/unverifiable BEFORE the empty-findings short-circuit — when
 * either is non-empty it is the BLOCKED channel even with empty findings (the rollup's
 * unverifiable/planConflicts lane does not ride on findings), previously stolen by the
 * short-circuit into a false APPROVED. */
export function deriveReviewStatus(handoff: Record<string, unknown> = {}): string {
  const { status, findings = [], unverifiable = [] } = handoff;
  // schema field is snake_case: plan_conflicts (do NOT destructure a camelCase planConflicts —
  // always empty)
  const planConflicts = handoff.plan_conflicts ?? [];
  if (status === "BLOCKED" || status === "TIMEOUT") return status as string;
  if ((unverifiable as unknown[]).length > 0 || (planConflicts as unknown[]).length > 0) return "BLOCKED";
  if ((findings as unknown[]).length === 0) {
    return status === "CHANGES_REQUESTED" ? "APPROVED" : (status as string) ?? "APPROVED";
  }
  return rollupStatus(findings as Array<{ severity?: string }>, unverifiable as unknown[], planConflicts as unknown[]);
}

/** Round conclusion → runner exit (Task 23 ③: BLOCKED → exit 1 on any channel — the T14
 * 「exit 0 + status BLOCKED」inversion). APPROVED / CHANGES_REQUESTED → 0 (terminal review
 * conclusions; the fix loop continues on its own pass); every other conclusion (BLOCKED /
 * TIMEOUT / absent) → 1. Single mapping point shared by dispatch/task.ts, dispatch/docs.ts and
 * the branch-review/fix CLIs. */
export function statusExitCode(status: string | undefined): number {
  return status === "APPROVED" || status === "CHANGES_REQUESTED" ? 0 : 1;
}

/** One unverifiable/plan-conflict entry → its compact text. Entries may be strings or objects
 * (claim / why / summary / item / description / section forms); object entries join all present
 * fields in a deterministic order so a "what + why" entry keeps both halves (the what/why blocker
 * contract — a single-key pick would drop the why). */
function entrySummary(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const parts = ["summary", "claim", "item", "description", "section", "why"]
      .map((k) => (k in o && o[k] != null ? String(o[k]) : ""))
      .filter((s) => s.length > 0);
    return parts.length > 0 ? parts.join("; ") : JSON.stringify(o);
  }
  return String(v);
}

/** BLOCKED carrier single point (Task 23 ① ④): the review-family unverifiable/plan_conflicts lane
 * must never fold to a bare BLOCKED string — the derived round carries the failure channel
 * (canonical category identity via FAILURE_CATEGORIES, never a literal) + a real blocker saying
 * what couldn't be verified / why (so derive → returnFromHandoff never falls back to a fabricated
 * default). Real sources already present (an agent/engine blocker or failure_category) ground the
 * round as-is («BLOCKED ⇒ blocker non-empty OR failure_category»); with no lane at all → {} — this
 * helper never invents prose. */
export function blockedCarrierFor(
  status: string | undefined,
  unverifiable: unknown[] = [],
  planConflicts: unknown[] = [],
  existing: { blocker?: unknown; failure_category?: unknown } = {},
): Record<string, string> {
  if (status !== "BLOCKED") return {};
  if (existing.blocker || existing.failure_category) return {};
  if (unverifiable.length > 0) {
    return {
      failure_category: FAILURE_CATEGORIES.UNVERIFIABLE.id,
      blocker: `could not verify: ${unverifiable.slice(0, 3).map(entrySummary).join("; ")}`,
    };
  }
  if (planConflicts.length > 0) {
    return {
      failure_category: FAILURE_CATEGORIES.PLAN_CONFLICT.id,
      blocker: `plan conflict: ${planConflicts.slice(0, 3).map(entrySummary).join("; ")}`,
    };
  }
  return {};
}

/** Unified read-back entry: status needs overwrite → returns the overwritten new handoff (original
 * untouched); no change → null (caller skips the write). Task 23 ①: the derived BLOCKED lane
 * carries its failure_category + real blocker via blockedCarrierFor — the only change to the
 * read-back contract; unverifiable/plan_conflicts-denoted review rounds land fully grounded. */
export function applyDerivedStatus(handoff: Record<string, unknown> = {}): Record<string, unknown> | null {
  const d = deriveReviewStatus(handoff);
  const carrier = blockedCarrierFor(
    d,
    (handoff.unverifiable as unknown[]) ?? [],
    (handoff.plan_conflicts as unknown[]) ?? [],
    { blocker: handoff.blocker, failure_category: handoff.failure_category },
  );
  if (d === handoff.status && Object.keys(carrier).length === 0) return null;
  return { ...handoff, status: d, ...carrier };
}

/** Finalization single entry: dispatch per mode → { handoff, exitCode }. The return block re-emits
 * from the finalized returnFromHandoff at the consumer. Three consumers share this implementation
 * (runner step 13 / docs-runner read-back / branch review read-back).
 * Task 23 ③: the round conclusion maps to exit at the single point — BLOCKED → 1 (any mode),
 * APPROVED / CHANGES_REQUESTED → 0.
 * Task 5: implement family takes HEAD via git (infra/git.ts) → the whole chain is async
 * (consumers always await). */
export async function finalizeHandoff({
  mode,
  returnBlock = [],
  agentHandoff = null,
  brief,
  repoRoot,
  workspace,
  taskNum,
}: {
  mode?: string;
  returnBlock?: string[];
  agentHandoff?: Record<string, unknown> | null;
  brief?: string;
  repoRoot?: string | null;
  workspace?: string;
  taskNum?: number;
} = {}): Promise<{ handoff: Record<string, unknown> | null; exitCode: number }> {
  if (mode === "review") {
    const derived = applyDerivedStatus(agentHandoff ?? {});
    const handoff = derived ?? agentHandoff ?? {};
    return { handoff, exitCode: statusExitCode(handoff.status as string) };
  }
  if (mode === "implement") {
    // No agentHandoff input slot: materialize from the return block + brief TASK_BASE + git HEAD
    // (T6 logic moved in). The evidence gate (behavior_change:true → hard) stays; the return block
    // re-emits from the finalized carrier.
    return await finalizeImplement({ returnBlock, brief, repoRoot, workspace, taskNum });
  }
  if (mode === "fix") {
    // work-type: the agent-declared status stays, vetoed at the commit-contract layer
    // (validateCommitContract).
    return {
      handoff: agentHandoff,
      exitCode: statusExitCode((agentHandoff?.status as string) ?? "BLOCKED"),
    };
  }
  throw new Error(`finalizeHandoff: unknown mode ${mode}`);
}

/** Finalization write-back single point (branch nit③: docs-runner/runner share this, deduplicating
 * the two near-verbatim write-backs):
 *   finalized.handoff is the same reference as local (derivation unchanged) → skip the write
 *     (no no-op overwrite), return false;
 *   otherwise writeOwnHandoff full-replace + sync local.status to the finalized value → true. */
export function persistFinalized(
  handoffPath: string,
  local: Record<string, unknown>,
  finalized: { handoff: Record<string, unknown> | null; exitCode: number } | null | undefined,
): boolean {
  if (!finalized?.handoff || finalized.handoff === local) return false;
  writeOwnHandoff(handoffPath, finalized.handoff);
  local.status = finalized.handoff.status;
  return true;
}

// ---- implement materialization (T6 materialization block moved in, behavior unchanged) ----
// readJson converges to ../handoff/write.ts (T7 nit2: three private copies unified to one point).

// TASK_BASE → the sole authority of implement commits.base. Missing brief / no TASK_BASE line →
// null (degrade without materialization: dry-run and smoke chains both land here, an ENOENT must
// never crash the runner).
function taskBaseFromBrief(briefPath: string | undefined): string | null {
  if (!briefPath || !existsSync(briefPath)) return null;
  try {
    return readFileSync(briefPath, "utf8").match(/^TASK_BASE: (\S+)/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

// Return block `artifacts:` line (key=value whitespace-separated) → artifacts object; missing line
// / empty → {}.
function artifactsFromReturnLine(line: string | undefined): Record<string, string> {
  const m = String(line).match(/^artifacts:\s*(.*)$/);
  if (!m || !m[1].trim()) return {};
  const artifacts: Record<string, string> = {};
  for (const pair of m[1].trim().split(/\s+/)) {
    const eq = pair.indexOf("=");
    if (eq > 0) artifacts[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return artifacts;
}

// Return block `status:` line → materialized status. The schema accepts only APPROVED/BLOCKED —
// anything non-APPROVED (NEEDS_CONTEXT / <missing> …) folds to BLOCKED, raw passthrough for the
// blocker (return block and handoff/exit stay consistent).
function implementStatusFromReturnLine(line: string | undefined): { status: string; raw: string } {
  const raw = String(line).replace(/^status:\s*/, "").trim();
  return { status: raw === "APPROVED" ? "APPROVED" : "BLOCKED", raw };
}

// Return block `blocker:` line → blocker. Missing line (<missing>) / success default (none) → ""
// (no blocker field lands; returnFromHandoff presents the real-only blocker default at render).
function returnBlocker(line: string | undefined): string {
  const v = String(line).replace(/^blocker:\s*/, "").trim();
  return v && v !== "<missing>" && v !== "none" ? v : "";
}

// Evidence gate (implement non-dry-run materialization path only): the mechanical hard-gate's only
// trigger = the test-evidence behavior_change:true (brief.mjs only outputs the ### Task N section +
// TASK_BASE line; the repo has no mechanical complexity-tier source).
// hard → BLOCKED overwrite; everything else (simple / no behavior_change / unreadable-unparseable
// file) → soft WARN note.
function evidenceGate(
  workspace: string | undefined,
  taskNum: number | undefined,
): { hard: boolean; warn: string } {
  const ev = readJson(path.join(workspace ?? "", `task-${taskNum}-test-evidence.json`)) as Record<string, unknown> | null;
  if (!ev) return { hard: false, warn: `test-evidence missing or unparseable for task ${taskNum} (soft WARN)` };
  if (ev.behavior_change !== true) return { hard: false, warn: "" };
  const missing = ["command", "passed", "exit_code"].filter((k) => !(k in ev));
  if (missing.length > 0) {
    return { hard: true, warn: `test_evidence gate: hard 要求 command/passed/exit_code (missing: ${missing.join(", ")})` };
  }
  return { hard: false, warn: "" };
}

/** Materialization: brief TASK_BASE → commits.base (sole authority); git HEAD → commits.head
 * (nullable repoRoot → head omitted). Degrade fail-open: missing brief / no TASK_BASE →
 * { handoff: null, exitCode: 0 } (no materialization; the runner keeps the agent's original
 * return block and notes a stderr CDD_WARN). hard gate / status BLOCKED → exitCode 1. */
export async function finalizeImplement({
  returnBlock = [],
  brief,
  repoRoot,
  workspace,
  taskNum,
}: {
  returnBlock?: string[];
  brief?: string;
  repoRoot?: string | null;
  workspace?: string;
  taskNum?: number;
}): Promise<{ handoff: Record<string, unknown> | null; exitCode: number }> {
  const base = taskBaseFromBrief(brief);
  if (!base) {
    process.stderr.write(`CDD_WARN: implement handoff not materialized — brief missing or no TASK_BASE line: ${brief}\n`);
    return { handoff: null, exitCode: 0 };
  }
  // T6 nit3: destructured naming replaces returnBlock[0]/[2]/[3] magic-index subscripts (the
  // commits line is deliberately ignored — materialized head takes git authority).
  const [statusLine, , artifactsLine, blockerLine] = returnBlock;
  const { status, raw } = implementStatusFromReturnLine(statusLine ?? "");
  let blocker = returnBlocker(blockerLine ?? "");
  if (raw !== "APPROVED" && !blocker) blocker = `implement return status "${raw}" without blocker`;
  const head = repoRoot ? await gitRevParseHead(repoRoot) : null;
  const gate = evidenceGate(workspace, taskNum);
  if (gate.hard) {
    blocker = gate.warn;
    // hard gate → CDD_BLOCKED diagnostic (aligned with the legacy runner finish(…, gate.warn, …)’s
    // stderr output).
    process.stderr.write(`CDD_BLOCKED: ${gate.warn}\n`);
  } else if (gate.warn) {
    process.stderr.write(`CDD_WARN: ${gate.warn}\n`);
  }
  // Write side through the schema (T5): the candidate passes normalizeHandoff for its key set —
  // the key-set authority is schema.properties, the write side carries no second hand-written
  // field list (undeclared keys never enter the carrier; an empty/undefined `blocker` lands no
  // field, replacing the legacy manual `if (blocker) handoff.blocker = blocker` gate).
  const handoff = normalizeHandoff(
    {
      task: taskNum,
      phase: "implement",
      status: gate.hard ? "BLOCKED" : status,
      artifacts: artifactsFromReturnLine(artifactsLine ?? ""),
      findings: [],
      commits: { base, ...(head ? { head } : {}) },
      blocker: blocker || undefined,
    },
    "task",
  ) as Record<string, unknown>;
  const exitCode = statusExitCode(handoff.status as string);
  return { handoff, exitCode };
}