// packages/cdd-engine/src/cli/branch-fix.ts — `cdd fix --type branch` (Task 9; spec E2①).
// The branch-level review→fix loop's fix channel (the engine-closed counterpart of
// cli/branch-review.ts): reads the source branch-review handoff (--findings IS the review
// handoff — branch-review-{base7}..{head7}-r{R}.json contains findings[]), derives the fix
// round + the embedded BASE..HEAD ref from that file NAME (fix writes branch-fix-{base7}..{head7}-r{R}.json,
// same round/ref as the source — same convention as the task/spec/plan fix families),
// renders the fix prompt (task-family shell + RETURN_STDOUT_BLOCK, task-family round-context
// slots minus TASK_NUMBER/TASK_CONSTRAINTS — TASK_BRIEF carries the plan path as the
// branch-level brief; TASK_NUMBER/TASK_CONSTRAINTS are empty for the branch family via the
// mode-union template), and closes the loop through the same exit gate as the task family:
// validateCommitContract("fix", …) — dirty tree → BLOCKED rewrite; clean tree + commits.head ≠
// HEAD → BLOCKED (F1). The fix's FIX_BASE = the source review's commits.base (the reviewed range
// base) — same fixed-point derivation as task.ts's step-5 cross-phase read.
//
// Convergence law (shared with plan/spec doc_hash ref-move): the fix commits its changes → HEAD
// moves → a re-review of the NEW ref is a NEW branch review (review.branch resolveNextRound keys
// on the concrete base7..head7 embedded in the file name). No reviewConvergenceGuard here — the fix
// is a work-type phase, and re-review legality is decided by the review channel's ref-keyed
// rounds (branch-review.ts), not by this file.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadRegistry, checkHarness, CddBlockedError, REG_PATH } from "../infra/registry.ts";
import { renderTemplate, reviewHardGate } from "../render/templates.ts";
import * as handoffNaming from "../artifacts/handoff/naming.ts";
import { validateHandoffSchema, recoverHandoff } from "../rules/schema.ts";
import { validateCommitContract } from "../rules/commit.ts";
import { writeHandoff, writeOwnHandoff, readJson } from "../artifacts/handoff/write.ts";
import { finalizeHandoff } from "../artifacts/handoff/finalize.ts";
import { getRoot, resolveDocArg } from "../infra/root.ts";
import { invokeCliWithRetry, resolveTimeoutMs } from "../infra/invoke.ts";
import { withLifecycle } from "../infra/proc.ts";
import { exitOk, exitWithCode } from "../infra/exit.ts";
import { DRY_RUN } from "./shared.ts";
import { returnCountersLine } from "../artifacts/progress.ts";

export interface BranchFixOpts {
  plan: string;
  findings: string;
  harness: string;
  type: string;
  root?: string;
  registryPath?: string;
}

// BLOCKED write single point for the branch-fix channel (mirror of writeBranchBlocked with the
// fix-family carrier shape): commits carries ONLY the FIX_BASE when it satisfies the schema's
// `^[0-9a-f]{40}$` (head is omitted — a BLOCKED fix has no head yet). `baseHandoff` = the already
// resolved handoff (schema-invalid branch keeps recovered findings via writeOwnHandoff full-replace).
export function writeBranchFixBlocked(
  handoffPath: string,
  { base, code, reason, findings = [], baseHandoff = null }: {
    base: string | null;
    code: number;
    reason?: string;
    findings?: Array<unknown>;
    baseHandoff?: Record<string, unknown> | null;
  },
): void {
  const fullBase = typeof base === "string" && /^[0-9a-f]{40}$/.test(base) ? base : null;
  const payload = {
    task: 1, phase: "fix", status: "BLOCKED",
    ...(fullBase ? { commits: { base: fullBase } } : {}),
    findings,
    artifacts: {},
    blocker: reason ?? `cli exited ${code} without writing handoff`,
  } as Record<string, unknown>;
  if (baseHandoff) writeOwnHandoff(handoffPath, payload);
  else writeHandoff(handoffPath, payload);
}

// The branch-fix dispatch body: the channel is fully engine-closed — the source review handoff,
// the round/ref derivation, the prompt, the spawn, the schema recovery and the exit gate all live
// here (zero inline orchestration; the agent's only job is to fix + commit + write the fix handoff).
export async function runBranchFix(opts: BranchFixOpts): Promise<void> {
  return withLifecycle(async () => {
    const { harness, plan, findings } = opts;
    // Registry-path test seam (same shape as runBranchReview's opts.registryPath): in-process
    // cases inject a ghost registry; the black-box path falls back to the REG_PATH single source.
    const registryPath = opts.registryPath ?? REG_PATH;

    // Harness registry gate (mirror branch-review).
    let entry: unknown;
    try {
      entry = checkHarness(loadRegistry(registryPath), harness, { dryRun: DRY_RUN() });
    } catch (e) {
      if (e instanceof CddBlockedError) {
        process.stderr.write(`${e.message}\n`);
        exitWithCode(e.exitCode);
      }
      throw e;
    }

    // Root single authority: in-process callers inject root via opts.root; the black-box path
    // falls back to the initRoot()-initialized singleton.
    const repoRoot = opts.root ?? getRoot();
    const workspace = handoffNaming.resolveWorkspace(plan, repoRoot);

    // Fix round + ref derive from the SOURCE REVIEW's file name (the findings file). roundPattern's
    // scan shape captures only the round ({base7}/{head7} are intentionally non-capturing scan
    // segments); the fix name must mirror the source's ref + round, so the ref segments are
    // re-derived from the SAME canonical family template with capturing groups (identical
    // placeholder substitution rules as roundPattern → the config name stays the single truth).
    // Group order: [1]=base7 [2]=head7 [3]=round. A non-matching findings name means the round is
    // underivable → usage error exit 2 (before any path resolution — the guard order contract, §2.4.2).
    const findingsBase = path.basename(findings);
    const refRoundRe = new RegExp(
      "^" + handoffNaming.familyConfig("review", "branch").name
        .replace("{round}", "(\\d+)")
        .replace("{base7}", "([0-9a-f]{7})")
        .replace("{head7}", "([0-9a-f]{7})")
        .replaceAll(".", "\\.")
      + "$",
    );
    const refRound = findingsBase.match(refRoundRe);
    if (!refRound) {
      process.stderr.write(`cdd fix --type branch: --findings must name a branch-review-{base7}..{head7}-r{R}.json file (round + ref derived from the source review); got: ${findings}\n`);
      exitWithCode(2);
    }
    const base7 = refRound[1];
    const head7 = refRound[2];
    const fixRound = Number(refRound[3]);
    if (!Number.isInteger(fixRound) || fixRound < 1) {
      process.stderr.write(`cdd fix --type branch: --findings round must be >= 1 (round derived from the source review); got: ${findings}\n`);
      exitWithCode(2);
    }
    // Canonical fix.branch family name — same ref + same round as the source review (the `round`
    // family's "source" semantics: the fix round is copied from the review it sources).
    const handoffPath = path.join(workspace, handoffNaming.handoffName("fix", "branch", { base7, head7, round: fixRound }));

    if (DRY_RUN()) {
      writeHandoff(handoffPath, {
        task: 1, phase: "fix", status: "APPROVED",
        commits: { base: "dry-run", head: "dry-run" }, findings: [], artifacts: {}, blocker: "dry-run",
      });
      // 5-line return block (array-assembled with the returnCountersLine 5th line — same-source with
      // branch-review.ts's dry-run block and task.ts's returnFourLines/returnFromHandoff).
      const returnBlock = [
        "status: APPROVED",
        "commits: base=dry-run head=dry-run",
        "artifacts: ",
        "blocker: dry-run",
        returnCountersLine(workspace),
      ];
      for (const line of returnBlock) process.stdout.write(`${line}\n`);
      exitOk();
      return;
    }

    // Non-dry-run: normalize --findings (repo-root-relative → absolute; missing → exit 1
    // three-line diagnostic — AFTER the round-derivation guard, so a round without a pattern
    // first fails as a usage error, exit 2) and read the FIX_BASE = the source review's
    // commits.base (the reviewed range base). Missing scan file → still norm it (a path miss is
    // the caller's coordinate error, exit 1); missing/unknown commits.base → BLOCK (no base = the
    // fix range is underivable, and the fix handoff must declare commits.base for the exit gate).
    const findingsPath = resolveDocArg(findings, repoRoot, "findings");
    const src = readJson(findingsPath);
    const fixBase = src?.commits?.base as string | undefined;
    if (!fixBase || fixBase === "unknown") {
      writeHandoff(handoffPath, {
        task: 1, phase: "fix", status: "BLOCKED",
        findings: [], artifacts: {},
        blocker: `source review handoff ${findingsPath} has no valid commits.base → cannot derive the fix BASE; fix the source review and re-run cdd fix --type branch`,
      });
      process.stderr.write(`CDD_BLOCKED: branch-fix source review missing commits.base\n`);
      exitWithCode(1);
    }

    // The fix prompt: task-family shell + RETURN_STDOUT_BLOCK return (the fix agent writes the
    // handoff + the return block; task-family round-context slots minus TASK_NUMBER/TASK_CONSTRAINTS
    // — empty for the branch family; TASK_BRIEF carries the plan path as the branch-level brief).
    const prompt = renderTemplate("fix", {
      MODE: "fix",
      TASK_WORKSPACE: workspace,
      WORKSPACE_SLUG: path.basename(workspace),
      TASK_FINDINGS: findingsPath,
      TASK_FIXED_POINT: fixBase,
      TASK_BRIEF: plan,
      HANDOFF_TARGET: handoffPath,
      REVIEW_PLAN_LINE: plan ? `**Plan:** ${plan}` : "",
      RETURN_FORMAT: "RETURN_STDOUT_BLOCK",
      HANDOFF_WRITE_GATE: reviewHardGate("RETURN_STDOUT_BLOCK", handoffPath),
    }, "cdd fix");

    // Invoke the harness CLI. (op,type) injection resolves the flat `prefix.fix` string
    // (/mattpocock-skills:tdd — the fix channel is work-type, not per-type).
    const timeoutMs = resolveTimeoutMs(process.env, "review");
    const res = await invokeCliWithRetry(entry as { cli: string; invoke: string; output?: string; prefix?: unknown; suffix?: unknown }, prompt, { op: "fix", type: "branch" }, process.env, repoRoot, timeoutMs);

    if (!res.ok) {
      if (!existsSync(handoffPath)) {
        writeBranchFixBlocked(handoffPath, { base: fixBase, code: res.code });
      }
      process.stderr.write(`CDD_BLOCKED: branch-fix failed (exit ${res.code})\n`);
      exitWithCode(1);
    }

    // Agent exited 0 but never wrote the handoff — BLOCKED (mirrors the runner's 10.5).
    if (!existsSync(handoffPath)) {
      writeBranchFixBlocked(handoffPath, {
        base: fixBase, code: 0,
        reason: `${path.basename(handoffPath)} not written after exit 0 → re-run cdd fix --type branch`,
      });
      process.stderr.write(`CDD_BLOCKED: branch-fix handoff not written\n`);
      exitWithCode(1);
    }

    // Agent wrote handoff — validate against the CDD task schema (mirrors runner 8.8; T5
    // CONTRACT_VIOLATION recovery: normalize → re-validate at most one round, findings preserved).
    const agentHandoff: Record<string, unknown> = JSON.parse(readFileSync(handoffPath, "utf8"));
    let handoff: Record<string, unknown> = agentHandoff;
    const sv = validateHandoffSchema(agentHandoff, "task");
    if (!sv.valid) {
      const rec = recoverHandoff(agentHandoff, "task");
      if (!rec.valid) {
        writeBranchFixBlocked(handoffPath, {
          base: fixBase, code: 0,
          baseHandoff: rec.handoff,
          findings: rec.preservedFindings,
          reason: `branch-fix handoff schema invalid${rec.reason} → fix and re-run cdd fix --type branch`,
        });
        process.stderr.write(`CDD_BLOCKED: branch-fix handoff schema invalid\n`);
        exitWithCode(1);
      }
      writeOwnHandoff(handoffPath, rec.handoff);
      handoff = rec.handoff;
    }
    // Finalize through the single finalization point (mode=fix → work-type passthrough: the
    // agent-declared status stays, vetoed by the commit-contract layer just below).
    // Task 23 ③: the fix round conclusion → exit (BLOCKED → 1, APPROVED/CHANGES_REQUESTED → 0) —
    // captured here, emitted after the clean-tree gate.
    const finalized = await finalizeHandoff({ mode: "fix", agentHandoff: handoff });
    if (finalized.handoff && finalized.handoff !== handoff) writeOwnHandoff(handoffPath, finalized.handoff);

    // Exit gate (post-flight 13.5): dirty tree → the commit contract rewrites the handoff to
    // BLOCKED (rewriteHandoffBlocked); clean tree + handoff.commits.head ≠ actual HEAD → BLOCKED
    // (F1). The fix agent committed → HEAD moved → its head must match; passing says the
    // reviewed-range fixes landed in the tree the NEXT branch-review will read (ref moved → new
    // review, never a false STOP — the Convergence law).
    const cv = await validateCommitContract("fix", repoRoot, { handoffPath });
    if (!cv.ok) {
      process.stderr.write(`CDD_BLOCKED: ${cv.blocker}\n`);
      exitWithCode(1);
    }

    exitWithCode(finalized.exitCode);
  });
}
