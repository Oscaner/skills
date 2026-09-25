// packages/cdd-engine/src/rules/closeout.ts — P2 T4: the SINGLE closeout mismatch inference module
// (engine rules single point). Consumed by BOTH the pre-flight hard gate (base docContractValidate
// — structural + terminal-debt surfaces) and the post-flight statusValidate highlight (the
// terminal-debt surface) — changing the inference here changes both channels together (同源回归).
//
// Input  = the parent-overall parse (four tables) + the declaration set (change-history backfill
//          claims + Phase-inventory columns) + the engine-derived terminal state (plan-complete =
//          derivePlanVerdict.done over EVERY plan workspace under the parent overall — the
//          effectiveGroups dispatch-group iteration, the same single derivation as the progress
//          surface (the group-following iteration covers the closeout terminal-debt verdict too).
// Output = the mismatch set on two surfaces:
//   structural    — missing cell / missing claim: the single audit entry (validateDispatchDocuments)
//                   consumed verbatim (Task 3 failure semantics; no second implementation).
//   terminal-debt — plan-complete but the overall carries no backfill claim for the phase
//                   (v1.12 user ruling: 回填 = branch-review 前置义务 — an unpaid completed plan is
//                   a hard-gated debt until the orchestration backfills the overall; no lane
//                   exemption — the docs channel no-ops only via its absent plan workspace, which is
//                   a hook-declared fact, never a constant here).
//
// Read-only by construction: a plan workspace without progress.json (fresh checkout / undispatched
// plan) is treated as not-done — 零误伤 and the module never materializes a workspace nor writes
// any doc (engine 零文档写入 — the backfill edit is orchestration's, never engine code's).
import { existsSync } from "node:fs";
import path from "node:path";

import {
  validateDispatchDocuments,
  parentOverallOf,
  parseOverall,
  extractClaimRows,
  fileNameSlug,
  mdNames,
  taskNumbersFromPlan,
  effectiveGroups,
  type DocValidationFailure,
} from "./documents.ts";
import { derivePlanVerdict } from "./status.ts";
import { resolveWorkspace } from "../artifacts/handoff/naming.ts";

export interface CloseoutMismatch {
  surface: "structural" | "terminal-debt";
  /** the phase id the mismatch concerns ("" for overall-level structural items). */
  phase: string;
  /** stable machine key (e.g. "plan-complete-unbackfilled"). */
  kind: string;
  /** the current Implementation plan column state (stripped) — the "可 diff 列态缺口" surface. */
  column: string;
  /** one-line human summary. */
  summary: string;
  /** the actionable backfill guidance. */
  fix: string;
}

export interface CloseoutResult {
  /** structural surface — the single audit entry output (missing cell / missing claim). */
  structural: DocValidationFailure[];
  /** terminal-debt surface — plan-complete unbackfilled members. */
  terminalDebt: CloseoutMismatch[];
  /** the resolved parent overall (Class B lineage) — shapes the debt guidance path; null on
   *  chain truncation (the four-table/dollar faces no-op on the same AC1 lineage rule). */
  overallPath: string | null;
}

/** Plan-complete check over a plan doc's engine workspace — SAFE (read-only + zero-false-positive):
 * a workspace without progress.json means the plan was never dispatched (fresh checkout / not yet
 * started) → not done. The guard replaces derivePlanVerdict's own read (which would otherwise
 * materialize an empty progress.json — a write the closeout surface must never perform). */
function planComplete(planPath: string, root: string): boolean {
  const workspace = resolveWorkspace(planPath, root);
  if (!existsSync(path.join(workspace, "progress.json"))) return false;
  return derivePlanVerdict(planPath, workspace, taskNumbersFromPlan, effectiveGroups).done;
}

/** The plan-doc enumeration under a parent overall — the SAME canonical glob the four-table
 *  document-existence face uses (`*-<slug>-<id>.md` / `*-<slug>-<id>-plan.md`), surfaced here as
 *  the per-phase engine-terminal-state source. */
function programPlans(plansDir: string, slug: string, id: string): string[] {
  const low = id.toLowerCase();
  return mdNames(plansDir).filter(
    (n) => n.endsWith(`-${slug}-${low}.md`) || n.endsWith(`-${slug}-${low}-plan.md`),
  );
}

/** deriveTerminalDebt — the terminal-debt surface: for every Phase-inventory row whose plan
 *  workspace reports complete (engine terminal state) but whose backfill claim is absent from the
 *  change history, one mismatch member (plan-complete 未回填). Enumerates EVERY plan workspace under
 *  the parent overall — a sibling phase's unpaid completion contributes too (跨 phase 欠账). */
export function deriveTerminalDebt(overallPath: string, root: string): CloseoutMismatch[] {
  const o = parseOverall(overallPath);
  if (!o.kernelOk) return []; // an unparseable kernel is already a structural failure — no debt to add
  const { planClaims } = extractClaimRows(o.historyRows);
  const slug = fileNameSlug(overallPath);
  const plansDir = path.join(path.dirname(overallPath), "..", "plans");
  const debt: CloseoutMismatch[] = [];
  for (const r of o.rows) {
    if (planClaims.has(r.id)) continue; // a backfill claim exists → the overall declares the phase (backfilled)
    for (const n of programPlans(plansDir, slug, r.id)) {
      const planPath = path.join(plansDir, n);
      if (!planComplete(planPath, root)) continue; // not complete → no debt (undispatched included)
      debt.push({
        surface: "terminal-debt",
        phase: r.id,
        kind: "plan-complete-unbackfilled",
        column: (r.plan ?? "").replace(/\*\*/g, "").trim(),
        summary: `${r.id} plan complete (engine terminal state) but the parent overall carries no backfill claim for it`,
        fix: `backfill-overall first (branch-review 前置义务): bump the overall version + add a change-history plan claim for ${r.id} + backfill its Phase-inventory columns (Implementation plan → Done), then re-dispatch`,
      });
    }
  }
  return debt;
}

/** deriveCloseoutMismatches — the single inference module: structural surface = the single audit
 *  entry (validateDispatchDocuments), terminal-debt surface = the engine-terminal merge
 *  (deriveTerminalDebt over the resolved parent overall). Pre-flight (docContractValidate) and
 *  post-flight (statusValidate) BOTH consume this function — one inference, two channels. */
export function deriveCloseoutMismatches(options: { entry: string; root: string }): CloseoutResult {
  const overallPath = parentOverallOf(options.entry, options.root);
  const structural = validateDispatchDocuments({ entry: options.entry, root: options.root });
  const terminalDebt = overallPath ? deriveTerminalDebt(overallPath, options.root) : [];
  return { structural, terminalDebt, overallPath };
}

/** Operator-facing guidance block for the terminal-debt surface (pre-flight BLOCK face): the
 *  backfill-overall step + one line per unpaid phase with its current column state. */
export function formatCloseoutDebtFailures(items: CloseoutMismatch[], overallPath: string): string {
  return [
    `- [closeout] ${overallPath} — plan complete but overall unbackfilled → 先 backfill-overall: version bump + change-history claim + column backfill (branch-review 前置义务)`,
    ...items.map((m) => `  - ${m.phase}: Implementation plan column ${JSON.stringify(m.column || "empty")} — no change-history claim → ${m.fix}`),
  ].join("\n");
}

/** stdout highlight line (post-flight statusValidate) — the next backfill step, pointing at the
 *  overall path (Class B lineage known) and the column-state gaps. Exit unchanged: informational. */
export function formatCloseoutDebtHighlight(items: CloseoutMismatch[], overallPath: string): string {
  const detail = items.map((m) => `${m.phase} (Implementation plan: ${m.column || "empty"})`).join(", ");
  return `CDD_CLOSEOUT: plan complete with terminal debt — next step: backfill-overall at ${overallPath}: ${detail} (version bump + claim + column backfill)`;
}
