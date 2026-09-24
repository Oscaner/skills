// packages/cdd-engine/src/artifacts/handoff/finalize.ts — handoff carrier finalization single point
// (T7; Task 8 TS port of finalize.mjs): agent content → finalized handoff → full-replace write →
// return block re-emit. Peer of handoff/naming (finalization is an independent concern).
// P6 T24 B: this file is the status-derivation family's SOLE owner (rollupStatus / deriveReviewStatus
// / applyDerivedStatus / statusExitCode / blockedCarrierFor — the five contract.mjs symbols +
// applyDerivedStatus) AND the CONTRACT_VIOLATION recovery unit's home (normalizeHandoff /
// recoverHandoff); P6 T24 C: the BLOCKED failure write single point (writeBlockedCarrier) lives
// here — the former docs/task/branch handwriting islands read no second definition.
// Task 23: ① three-surface orthogonalization — status (round conclusion) vs failure_category
// (mechanism channel) vs unverifiable[]/plan_conflicts[] (content notes) never fold: the derived
// BLOCKED lane carries blockedCarrierFor (category + real blocker). ③ statusExitCode maps the
// round conclusion to the runner exit (BLOCKED → 1 on any channel). ④ the materialized return
// blocker stays real-only (returnBlocker; no fabricated default). ⑤ return-block naming.
// Architecture: the engine is the carrier's single author (T5/T6/T7 unified); the agent only
// contributes content slices (findings/blocker/artifacts/notes).
// Dispatch per canonical family `status` rule (plan-constraints `status` single-authority):
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
// Import note (P6 T24 B: the schema⇄finalize direct cycle is broken): the CONTRACT_VIOLATION
// recovery unit (normalizeHandoff / recoverHandoff / arr / objOrEmpty) lives HERE (finalize is
// the status-derivation sole owner; normalize's rule ③ derives via applyDerivedStatus, local) —
// with the validator it consumes coming from rules/schema.ts. The edge is one-way
// (finalize → schema); schema.ts holds zero applyDerivedStatus reference.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { gitRevParseHead, gitMergeBaseIsAncestor } from "../../infra/git.ts";
import { invariant } from "../../infra/exit.ts";
import { hashFile } from "../hash.ts";
import { artifactsFromReturnLine, implementStatusFromReturnLine, returnBlocker, commitsFromReturnLine } from "../return-block.ts";
import { readJson, writeHandoff, writeOwnHandoff } from "./write.ts";
import { loadHandoffSchema, validateHandoffSchema } from "../../rules/schema.ts";
import { FAILURE_CATEGORIES } from "../../rules/failure.ts";
import { seedScopeBase, moveTaskScopeBaseEarlier, SHA40_RE } from "../progress.ts";
import { tasksKey } from "./naming.ts";

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
      invariant(false, `unknown severity: ${String(sev)}`);
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

// ---- CONTRACT_VIOLATION recovery unit (T5; relocated from rules/schema.ts by P6 T24 B — the
// applyDerivedStatus-dependent normalization now sits in its derivation owner's module) ----

// Array guard single point: agent-written `findings` / `unverifiable` / `plan_conflicts` are
// often "none" / {} / a number. rollupStatus's findings.some(...) would throw on a non-array,
// escaping along the runner's try/finally (no catch) to the bin top level — exit 2, no BLOCKED
// handoff written, findings lost. Both normalization and the recovery payload share this guard.
const arr = (v: unknown): Array<unknown> => (Array.isArray(v) ? v : []);

// Object guard (recovery payload only): normalizeHandoff passes non-objects through verbatim
// (a contract its own tests pin), so the recovery face closes on objects here: a hand-written
// BLOCKED carrier must never depend on the caller's spread semantics (spreading an array/string
// expands to indexed keys which the schema's additionalProperties rejects — the exact
// CONTRACT_VIOLATION shape this single point exists to eliminate).
const objOrEmpty = (o: unknown): Record<string, unknown> =>
  o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};

// Normalization single point (T5, same file as the validator → «normalize → re-validate» is one
// testable unit): three runners (run-task / run-docs / branch-review) share it on the
// CONTRACT_VIOLATION recovery path so findings survive in full (AC7 category-level). Three rules:
//   ① strip undeclared keys (the authoritative key set = schema.properties);
//   ② blocker: null → omit (schema declares string, null illegal);
//   ③ review family missing status → derive via applyDerivedStatus (work types never derived:
//      the schema's else.required forces the agent to declare them); the derived BLOCKED lane
//      carries failure_category + real blocker (Task 23 ① — never a bare BLOCKED fold).
// Side-effect free: returns a new object, never mutates; non-object input passes through
// verbatim (the recovery face closes it via objOrEmpty).
export function normalizeHandoff(
  obj: unknown,
  schemaName = "task",
): unknown {
  // Return `unknown` (not `Record<string, unknown>`): the object arm is only one branch — null /
  // arrays / primitives pass through verbatim (a contract this file's tests pin, and the recovery
  // face closes it via objOrEmpty), so a record-only annotation would misstate the shape.
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const allowed = new Set(Object.keys((loadHandoffSchema(schemaName) as Record<string, unknown>).properties ?? {}));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (!allowed.has(key)) continue; // ①
    if (key === "blocker" && value === null) continue; // ②
    out[key] = value;
  }
  const phase = out.phase;
  if (!("status" in out) && (phase === "review" || phase === "branch-review")) {
    // ③ derive via applyDerivedStatus (status + BLOCKED carrier). The arr() array-guards first —
    // deriveReviewStatus/blockedCarrierFor are array-contract code and would throw on raw
    // non-arrays («findings: 42 » arrives here in the recovery face); only the derivation sees
    // the guarded copy, the output object keeps the raw values (re-validation catches them).
    const derived = applyDerivedStatus({
      ...out,
      findings: arr(out.findings),
      unverifiable: arr(out.unverifiable),
      plan_conflicts: arr(out.plan_conflicts),
    });
    if (derived) {
      out.status = derived.status;
      for (const ck of ["blocker", "failure_category"] as const) {
        if (derived[ck] !== undefined) out[ck] = derived[ck];
      }
    }
  }
  return out;
}

// CONTRACT_VIOLATION recovery single point (T5): normalize → re-validate (one round, no loop).
// Three runners (run-task / run-docs / branch-review) share it, each keeping only its
// failure-payload difference (BLOCKED wording prefix + guidance + counter branch).
// Returns:
//   valid: true  → handoff = normalized result (caller writes and continues);
//   valid: false → handoff = normalized result (violating keys stripped, usable as a BLOCKED
//                  payload base), property = violating key, reason = failure detail (with the
//                  violating-key suffix — the single assembly point), preservedFindings = the
//                  array-guarded original findings (AC7 full retention, guard written once).
export function recoverHandoff(
  obj: unknown,
  schemaName = "task",
): {
  handoff: Record<string, unknown>;
  valid: boolean;
  property?: string;
  reason?: string;
  preservedFindings?: Array<unknown>;
} {
  const handoff = objOrEmpty(normalizeHandoff(obj, schemaName));
  const sv = validateHandoffSchema(handoff, schemaName);
  if (sv.valid) return { handoff, valid: true };
  // The violating key is taken from the round that saw the ORIGINAL object — normalization
  // already stripped top-level unknown keys, so the re-validate surface usually no longer
  // reports additionalProperties; only the original object's keys tell the agent which key
  // was rejected. (Nested additionalProperties can still surface on the re-validate face, so
  // first-wins.)
  const property = (validateHandoffSchema(obj, schemaName) as Extract<ReturnType<typeof validateHandoffSchema>, { valid: false }>)
    .property ?? sv.property;
  return {
    handoff,
    valid: false,
    property,
    reason: `${property ? ` (unexpected key: ${property})` : ""}: ${sv.reason}`,
    preservedFindings: arr(handoff.findings),
  };
}

// ---- BLOCKED failure write single point (P6 T24 C) ----
// writeBlockedCarrier unifies the four former handwriting islands (docs.ts writeBlocked · task.ts
// inline×4 · branch-review writeBranchBlocked · branch-fix writeBranchFixBlocked) into ONE carrier
// factory: work-type failure payloads (status default BLOCKED; status param keeps the TIMEOUT lane)
// write through here, and callers pass `commits` only when they have schema-legal bases (task
// passes {base:"unknown"} on the EXECUTION_FAILURE lane; branch callers pre-filter the base to
// 40-hex). `doc` carves the docs-family content-state token (doc_path + doc_hash via hashFile —
// the hash single point). `fullReplace` = the schema-invalid branch (writeOwnHandoff: offending
// keys never stay on disk); absent → shallow writeHandoff.
export interface BlockedCarrierInput {
  /** The dispatch group (the carrier's single task identity — single-data-model, no separate
   * top-level `task` scalar). */
  tasks?: number[];
  phase: string;
  status?: string;
  failure_category?: string;
  findings?: unknown[];
  artifacts?: Record<string, unknown>;
  /** commits — passed verbatim (callers decide legality: task's {base:"unknown"} vs branch's
   * 40-hex-filtered base). */
  commits?: Record<string, unknown>;
  blocker: string;
  /** docs-family review target — carves doc_path + the doc_hash content-state token. */
  doc?: string;
  /** resume contract (T26/spec T7.5): settleResidue's salvage record rides any TIMEOUT /
   * EXECUTION_FAILURE carrier so the re-dispatch pre-flight can restore the WIP. */
  recovery?: Record<string, unknown>;
  /** death-reason archival (T26): recorded when a dead round salvages NOTHING (recovery is absent,
   * so recovery.cause cannot carry the termination cause) — the carrier stays replayable by cause. */
  notes?: string;
  /** schema-invalid branch: full-replace write so offending keys never stay on disk. */
  fullReplace?: boolean;
}

export function writeBlockedCarrier(
  handoffPath: string,
  input: BlockedCarrierInput,
): { exitCode: 1; handoff: Record<string, unknown> } {
  const payload: Record<string, unknown> = {
    ...(input.tasks ? { tasks: input.tasks } : {}),
    phase: input.phase,
    status: input.status ?? "BLOCKED",
  };
  if (input.failure_category) payload.failure_category = input.failure_category;
  if (input.commits) payload.commits = input.commits;
  if (input.recovery) payload.recovery = input.recovery;
  if (input.notes) payload.notes = input.notes;
  payload.findings = input.findings ?? [];
  payload.artifacts = input.artifacts ?? {};
  if (input.doc) {
    payload.doc_path = input.doc;
    payload.doc_hash = hashFile(input.doc);
  }
  payload.blocker = input.blocker;
  if (input.fullReplace) writeOwnHandoff(handoffPath, payload);
  else writeHandoff(handoffPath, payload);
  return { exitCode: 1, handoff: payload };
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
  tasks,
  resumeScopeBase = null,
}: {
  mode?: string;
  returnBlock?: string[];
  agentHandoff?: Record<string, unknown> | null;
  brief?: string;
  repoRoot?: string | null;
  workspace?: string;
  /** The dispatch group — the materialized carrier's `tasks` identity + the group-keyed
   * evidence/scope-ledger key (single-data-model). */
  tasks?: number[];
  /** The resume pre-flight's captured recovery.scope_base — the settled ledger anchor riding
   *  the dead-round carrier (T27, spec T7.6). Finalize uses it to pull the ledger strictly earlier.
   *  Passed by the dispatch — the implement materialization is the only consumer. */
  resumeScopeBase?: string | null;
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
    return await finalizeImplement({ returnBlock, brief, repoRoot, workspace, tasks, resumeScopeBase });
  }
  if (mode === "fix") {
    // work-type: the agent-declared status stays, vetoed at the commit-contract layer
    // (validateCommitContract).
    return {
      handoff: agentHandoff,
      exitCode: statusExitCode((agentHandoff?.status as string) ?? "BLOCKED"),
    };
  }
  invariant(mode === "review" || mode === "implement" || mode === "fix", `finalizeHandoff: unknown mode ${mode}`);
  return { handoff: null, exitCode: 1 }; // unreachable (invariant narrows to the three handled modes)
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
// never crash the runner). Exported for the dispatch's settleResidue fallback (scope ledger, T27).
export function taskBaseFromBrief(briefPath: string | undefined): string | null {
  if (!briefPath || !existsSync(briefPath)) return null;
  try {
    return readFileSync(briefPath, "utf8").match(/^TASK_BASE: (\S+)/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

// Return block `status:` / `artifacts:` / `blocker:` line parsers (artifactsFromReturnLine /
// implementStatusFromReturnLine / returnBlocker) are imported from ../return-block.ts — the return
// block text plane's single point (P6 T24 C); the former private copies are gone.

// Evidence gate (implement non-dry-run materialization path only): the mechanical hard-gate's only
// trigger = the test-evidence behavior_change:true (the brief outputs the group's task sections +
// TASK_BASE line; the repo has no mechanical complexity-tier source).
// hard → BLOCKED overwrite; everything else (simple / no behavior_change / unreadable-unparseable
// file) → soft WARN note. Grouped materialization reads the group-keyed evidence artifact
// (`tasks-{a}-{b}-test-evidence.json`).
function evidenceGate(
  workspace: string | undefined,
  groupKey: string | null,
): { hard: boolean; warn: string } {
  const ev = groupKey != null
    ? readJson(path.join(workspace ?? "", `tasks-${groupKey}-test-evidence.json`)) as Record<string, unknown> | null
    : null;
  if (!ev) return { hard: false, warn: `test-evidence missing or unparseable for task group ${groupKey} (soft WARN)` };
  if (ev.behavior_change !== true) return { hard: false, warn: "" };
  const missing = ["command", "passed", "exit_code"].filter((k) => !(k in ev));
  if (missing.length > 0) {
    return { hard: true, warn: `test_evidence gate: hard requires command/passed/exit_code (missing: ${missing.join(", ")})` };
  }
  return { hard: false, warn: "" };
}

/** Materialization: brief TASK_BASE → commits.base (sole authority); git HEAD → commits.head
 * (nullable repoRoot → head omitted). Degrade fail-open: missing brief / no TASK_BASE →
 * { handoff: null, exitCode: 0 } (no materialization; the runner keeps the agent's original
 * return block and notes a stderr CDD_WARN). hard gate / status BLOCKED → exitCode 1.
 *
 * T27 (spec T7.6) — roundBase/scopeBase split: a resume round's re-dispatch brief TASK_BASE IS the
 * dead round's head (materialized base==head — the T26 collapse signature). Only then may the
 * return block's `commits: base=` declaration — the recovering agent's audit of the true scope
 * start (the round completed the deliverable audit first) — be validated (40-hex, ≠ HEAD, HEAD
 * ancestor via git merge-base) and ADOPTED as commits.base, so the next review's fixed-point range
 * is `declared..HEAD` (real contributions) instead of the empty `head..HEAD`. Fresh implement
 * (base≠head) never adopts — the agent-base fraud face stays closed on fresh rounds. The task scope
 * ledger (engine-owned, progress.json tasks[N].scope_base) is seeded with the brief TASK_BASE here
 * (earliest-wins; later rounds' brief snapshots never overwrite it), then pulled strictly earlier
 * by the resume-declared anchor and the adopted base. Fail-open: ledger/ancestry errors never block
 * the carrier write. */
export async function finalizeImplement({
  returnBlock = [],
  brief,
  repoRoot,
  workspace,
  tasks,
  resumeScopeBase = null,
}: {
  returnBlock?: string[];
  brief?: string;
  repoRoot?: string | null;
  workspace?: string;
  /** The dispatch group — the carrier's `tasks` identity + the group-keyed evidence/scope-ledger
   * key. Null → legacy task-less materialization (no carrier identity). */
  tasks?: number[];
  /** The resume pre-flight's captured recovery.scope_base — the settled ledger anchor riding
   *  the dead-round carrier, used to pull the ledger strictly earlier (T27, spec T7.6). */
  resumeScopeBase?: string | null;
}): Promise<{ handoff: Record<string, unknown> | null; exitCode: number }> {
  const base = taskBaseFromBrief(brief);
  if (!base) {
    process.stderr.write(`CDD_WARN: implement handoff not materialized — brief missing or no TASK_BASE line: ${brief}\n`);
    return { handoff: null, exitCode: 0 };
  }
  // The ledger/evidence identity: the group key (a single-task group's key `"1"` resolves the
  // per-task row — backward compatible ledger shape).
  const groupKey = tasks ? tasksKey(tasks) : null;
  // Destructured naming replaces returnBlock[0]/[2]/[3] magic-index subscripts (T6 nit3). The
  // commits line's head is ignored on fresh materialization — git HEAD takes commit authority;
  // the T27 resume-declared lane below reads its base= value instead.
  const [statusLine, , artifactsLine, blockerLine] = returnBlock;
  const { status, raw } = implementStatusFromReturnLine(statusLine ?? "");
  let blocker = returnBlocker(blockerLine ?? "");
  if (raw !== "APPROVED" && !blocker) blocker = `implement return status "${raw}" without blocker`;
  const head = repoRoot ? await gitRevParseHead(repoRoot) : null;
  // A materialization wearing the resume signature (base==head) may reconsider its base — the
  // fresh-implement base authority is untouched (T27 adoption lane).
  let commitsBase = base;
  if (repoRoot && head && base === head) {
    const declared = commitsFromReturnLine(returnBlock[1] ?? "").base;
    if (
      declared
      && SHA40_RE.test(declared)
      && declared !== head
      && (await gitMergeBaseIsAncestor(repoRoot, declared, head))
    ) {
      commitsBase = declared;
    }
  }
  // The scope ledger seeds the brief TASK_BASE (T27: earliest-wins — re-dispatches carry LATER
  // TASK_BASE snapshots that must never overwrite the round-1 anchor), then moves the ledger
  // strictly earlier along the resume anchors (the recovery-carrier scope_base and the adopted
  // base). progressDir == workspace (ledgerPath = <workspace>/progress.json). Null key → skip
  // the ledger (a task-less materialization writes no scope state).
  const seedKey = groupKey;
  if (repoRoot && head && workspace && seedKey != null) {
    seedScopeBase(workspace, seedKey, base);
    if (resumeScopeBase) await moveTaskScopeBaseEarlier(workspace, seedKey, resumeScopeBase, repoRoot, head);
    if (commitsBase !== base) await moveTaskScopeBaseEarlier(workspace, seedKey, commitsBase, repoRoot, head);
  }
  const gate = evidenceGate(workspace, groupKey);
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
      ...(tasks ? { tasks } : {}),
      phase: "implement",
      status: gate.hard ? "BLOCKED" : status,
      artifacts: artifactsFromReturnLine(artifactsLine ?? ""),
      findings: [],
      commits: { base: commitsBase, ...(head ? { head } : {}) },
      blocker: blocker || undefined,
    },
    "task",
  ) as Record<string, unknown>;
  const exitCode = statusExitCode(handoff.status as string);
  return { handoff, exitCode };
}
