// packages/cdd-engine/src/cli/branch-review.ts — `cdd review --type branch` (ex branch-review bin
// action body). spec §2.3 split: runBranchReview + writeBranchBlocked live here. AC15 round
// sequence + Review Convergence (previous-round lookup filtered by base7..head7 embedded in the
// filename).
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadRegistry, checkHarness, CddBlockedError, REG_PATH } from "../infra/registry.ts";
import { renderTemplate, reviewTypeConfig, reviewArtifactConfig, reviewHardGate } from "../render/templates.ts";
import * as handoffNaming from "../artifacts/handoff/naming.ts";
import { validateHandoffSchema, recoverHandoff } from "../rules/schema.ts";
import { writeHandoff, writeOwnHandoff } from "../artifacts/handoff/write.ts";
import { finalizeHandoff } from "../artifacts/handoff/finalize.ts";
import { getRoot } from "../infra/root.ts";
import { invokeCliWithRetry, resolveTimeoutMs } from "../infra/invoke.ts";
import { withLifecycle } from "../infra/proc.ts";
import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from "../infra/exit.ts";
import { DRY_RUN, reviewConvergenceGuard } from "./shared.ts";
import { returnCountersLine } from "../artifacts/progress.ts";

export interface BranchReviewOpts {
  plan: string;
  base: string;
  head: string;
  harness: string;
  type: string;
  task?: number;
  round?: string;
  root?: string;
  registryPath?: string;
}

// BLOCKED write single point. T5: `findings` param (default `[]`) + `baseHandoff` = the already
// resolved handoff (the schema-invalid branch passes the normalized result) → writeOwnHandoff
// full-replace — violating keys never stay on disk, findings survive in full. The other two call
// sites (`:107` CLI never wrote a handoff / `:115` no handoff after exit 0) have no resolved
// content to keep → still `[]`. review-3 finding 1 (warn): the payload no longer `...(baseHandoff
// ?? {})` spreads (agent values on declared keys must not enter the carrier); `commits` is written
// only when `base` satisfies the schema's `^[0-9a-f]{40}$` — a short-形 base (`abc1234`) is carried
// by the AC15 base7..head7 file name, and the carrier omitting commits stays legal; a BLOCKED
// payload must always pass its own validation.
export function writeBranchBlocked(
  handoffPath: string,
  { base, head, code, reason, findings = [], baseHandoff = null }: {
    base: string;
    head: string;
    code: number;
    reason?: string;
    findings?: Array<unknown>;
    baseHandoff?: Record<string, unknown> | null;
  },
): void {
  const fullBase = typeof base === "string" && /^[0-9a-f]{40}$/.test(base) ? base : null;
  const payload = {
    task: 1, phase: "branch-review", status: "BLOCKED",
    ...(fullBase ? { commits: { base: fullBase, ...(typeof head === "string" && head ? { head } : {}) } } : {}),
    findings,
    artifacts: {},
    blocker: reason ?? `cli exited ${code} without writing handoff`,
  } as Record<string, unknown>;
  if (baseHandoff) writeOwnHandoff(handoffPath, payload);
  else writeHandoff(handoffPath, payload);
}

// Inline of the former branch-review bin action body, wired with the AC15 round sequence +
// Review Convergence (previous-round lookup filtered by base7..head7 embedded in the filename;
// a ref change = a new review, never falsely rejected).
export async function runBranchReview(opts: BranchReviewOpts): Promise<void> {
  return withLifecycle(async () => {
    const { harness, plan, base, head } = opts;
    // Registry-path test seam (same shape as runTask's opts.registryPath): in-process cases
    // inject a ghost registry; the black-box path falls back to the REG_PATH single source
    // (the engine does not compute a second source itself).
    const registryPath = opts.registryPath ?? REG_PATH;

    // Harness registry gate.
    let entry: unknown;
    try {
      entry = checkHarness(loadRegistry(registryPath), harness, { dryRun: DRY_RUN() });
    } catch (e) {
      if (e instanceof CddBlockedError) {
        process.stderr.write(`${e.message}\n`);
        e.kind === "cli-missing" ? exitCliMissing() : exitBlocked();
      }
      throw e;
    }

    // Root single authority (src/infra/root.ts): initRoot() already performed the "not a git repo
    // → BLOCKED exit 1" ruling in bin's preAction, so no guard here — getRoot() always returns a
    // non-empty string; the empty-value fallback (a second root source) was removed with the
    // closure cleanup. Root injection contract (P4 §2.3.1, same shape as runReview/runFix):
    // in-process callers inject root via opts.root; the black-box path falls back to the
    // initRoot()-initialized singleton — runReview's branch branch hands opts.root through
    // verbatim, so reading only the singleton here would be a silent "accepts-but-ignores" seam
    // (an in-process caller that never initRoot()'d would get the throw).
    const repoRoot = opts.root ?? getRoot();
    const base7 = String(base).slice(0, 7);
    const head7 = String(head).slice(0, 7);
    // Workspace same-source with the other review types: resolveWorkspace(plan)
    // (.osuperpowers/cdd/<slug>/).
    const workspace = handoffNaming.resolveWorkspace(plan, repoRoot);

    // AC15 wiring: per-ref round seq (ref embedded in the file name → resolveNextRound takes the
    // concrete base7/head7 for per-ref rounds; other refs' rounds never interfere with this one)
    // + --round backfill validation (conflict → exit 2) + Convergence reads the previous round
    // (prevHandoffPath concrete-matches the same ref).
    const round = handoffNaming.resolveNextRound(workspace, "review", "branch", { base7, head7 });
    if (opts.round && Number(opts.round) !== round) {
      process.stderr.write(`--round ${opts.round} ≠ engine round ${round}\n`);
      exitWithCode(2);
    }
    const prevPath = handoffNaming.prevHandoffPath(workspace, "review", "branch", round, { base7, head7 });
    const prev = prevPath && existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : null;
    // Stop only on an APPROVED round with blocker=0 (SP-4) — a BLOCKED/TIMEOUT branch review
    // round with findings:[] must be re-dispatchable, not rejected as "already done".
    if (prev) reviewConvergenceGuard(prev, "branch", round, `${base7}..${head7}`);

    // Per-round handoff filename (canonical review.branch family; branch-fix re-reviews reuse
    // distinct files).
    const handoffPath = path.join(workspace, handoffNaming.handoffName("review", "branch", { base7, head7, round }));
    mkdirSync(workspace, { recursive: true });

    if (DRY_RUN()) {
      writeHandoff(handoffPath, {
        task: 1, phase: "branch-review", status: "APPROVED",
        commits: { base, head }, findings: [], artifacts: {}, blocker: "dry-run",
      });
      // T7 (the third return block producer): the branch dry-run return block is array-assembled with returnCountersLine
      // (workspace) appended as the 5th line — same-source as returnFourLines / returnFromHandoff via
      // src/artifacts/progress.ts#returnCountersLine (the unique construction point); out of sync,
      // the task family's 5-line vs branch family's 4-line would fork (the 5th counters-presence
      // assertion in scripts/validate/smoke-cdd.mjs is exactly this). workspace is in scope of
      // the writeHandoff at :72-75.
      const returnBlock = [
        "status: APPROVED",
        `commits: base=${base} head=${head}`,
        "artifacts: ",
        "blocker: dry-run",
        returnCountersLine(workspace),
      ];
      for (const line of returnBlock) process.stdout.write(`${line}\n`);
      exitOk();
      return;
    }

    // branch review routes through the docs-family shell (Task 20: docs/review.md is gone; the
    // unified constant shell + RETURN_FORMAT-driven return constant + round-context slots, data-
    // forced by the contract) + the return block four-line contract. MODE routes the mode-union round-context;
    // the schema lives verbatim in the shell (no {{HANDOFF_SCHEMA_JSON}} replace remains).
    const cfg = reviewTypeConfig("branch");
    const art = reviewArtifactConfig("branch");
    const prompt = renderTemplate("review", {
      MODE: "review",
      REVIEW_TYPE: "branch",
      TASK_WORKSPACE: workspace,
      WORKSPACE_SLUG: path.basename(workspace),
      REVIEW_LENS_GUIDE: cfg.lensEnum.join(" · "),
      REVIEW_REFERENCE: `${base}..${head}`,
      REVIEW_AXES: cfg.axesGuide,
      HANDOFF_TARGET: handoffPath,
      RETURN_FORMAT: art.returnFormat,
      REVIEW_PLAN_LINE: opts.plan ? `**Plan:** ${opts.plan}` : "",
      HANDOFF_WRITE_GATE: reviewHardGate(art.returnFormat, handoffPath),
    }, "cdd review");

    // Invoke harness CLI. (op,type) injection resolves into prefix.review.branch (the old
    // branch-review standalone bin is deleted, its logic inlined here).
    const timeoutMs = resolveTimeoutMs(process.env, "review");
    const res = await invokeCliWithRetry(entry as { cli: string; invoke: string; output?: string; prefix?: unknown; suffix?: unknown }, prompt, { op: "review", type: "branch" }, process.env, repoRoot, timeoutMs);

    if (!res.ok) {
      if (!existsSync(handoffPath)) {
        writeBranchBlocked(handoffPath, { base, head, code: res.code });
      }
      process.stderr.write(`CDD_BLOCKED: branch-review failed (exit ${res.code})\n`);
      exitWithCode(1);
    }

    // Agent exited 0 but never wrote the handoff — BLOCKED (mirrors runner step 10.5).
    if (!existsSync(handoffPath)) {
      writeBranchBlocked(handoffPath, { base, head, code: 0, reason: `${path.basename(handoffPath)} not written after exit 0 → re-run branch-review` });
      process.stderr.write(`CDD_BLOCKED: branch-review handoff not written\n`);
      exitWithCode(1);
    }

    // Agent wrote handoff — validate against the CDD schema (mirrors runner step 8.8).
    if (existsSync(handoffPath)) {
      const agentHandoff: Record<string, unknown> = JSON.parse(readFileSync(handoffPath, "utf8"));
      const sv = validateHandoffSchema(agentHandoff, "task");
      // T5 CONTRACT_VIOLATION recovery (spec §2.5.2, AC7 category-level: branch dispatch shares
      // the task/spec/plan strategy): normalize → re-validate (at most one round, no loop).
      // Hit → same-source write + finalize from the normalized object; still failing → BLOCKED
      // keeping the already-resolved findings (previously hard-coded findings: [] — the A4 bug).
      let handoff: Record<string, unknown> = agentHandoff;
      if (!sv.valid) {
        // Recovery single point = src/rules/schema.ts#recoverHandoff (normalize → re-validate,
        // one round max; the violating-key suffix + findings array guard are written there once —
        // this path keeps only its own failure-payload difference).
        const rec = recoverHandoff(agentHandoff, "task");
        if (!rec.valid) {
          writeBranchBlocked(handoffPath, {
            base, head, code: 0,
            baseHandoff: rec.handoff,
            findings: rec.preservedFindings,
            reason: `branch-review handoff schema invalid${rec.reason} → fix and re-run branch-review`,
          });
          process.stderr.write(`CDD_BLOCKED: branch-review handoff schema invalid\n`);
          exitWithCode(1);
        }
        writeOwnHandoff(handoffPath, rec.handoff);
        handoff = rec.handoff;
      }
      // T5/T7: status single authority — branch review (review family) reads back through
      // finalizeHandoff finalization (rollup derived override, SP-4 exempts failure rounds);
      // the finalized write uses writeOwnHandoff (the engine is the carrier's sole author,
      // full-replace). The three consumers (runner/docs-runner/cdd) share the same
      // finalizeHandoff single point, each not wired separately.
      // Task 23 ③: the exit comes from the finalized round conclusion (BLOCKED → 1,
      // APPROVED/CHANGES_REQUESTED → 0) — this is the sole exit path once the agent wrote a
      // handoff; exitWithCode throws (infra/exit.ts, never returns), so the old `return` tail
      // and the trailing `exitOk()` are dead and folded out.
      const finalized = await finalizeHandoff({ mode: "review", agentHandoff: handoff });
      if (finalized.handoff && finalized.handoff !== handoff) writeOwnHandoff(handoffPath, finalized.handoff);
      exitWithCode(finalized.exitCode);
    }
  });
}
