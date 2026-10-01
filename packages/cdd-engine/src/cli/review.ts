// packages/cdd-engine/src/cli/review.ts — `cdd review` (task/branch/spec/plan four-type dispatch).
// spec §2.3 split (ex bin/cdd.mjs merged face): review dispatch lives here; the shared host
// detection + Convergence guard cluster (detectCurrentHarness/requireHostHarness/DRY_RUN/parseTaskList/
// resolveTargetDoc/blockerCount/convergedExit3/reviewConvergenceGuard) moved to src/cli/shared.ts
// (spec §2.6 shared split, ownership by closure completeness), reused by the 3 consumers
// (fix/parse/branch-review) and this file via shared (single host fact source).
// Task 6/7: this file stays a COMPOSITE ROOT (argv-side guards + lifecycle construction + exit —
// Criterion ⑤ — no forwarding shells): the branch channel constructs BranchReviewLifecycle inline
// (cli/branch-review.ts deleted), the task channel delegates to TaskLifecycle.run, the spec/plan
// channel to DocsLifecycle.run.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Handoff } from "../artifacts/handoff.ts";
import { hashFile } from "../artifacts/hash.ts";
import { RoundContext } from "../artifacts/round-context.ts";
import { DOC_TOKENS } from "../documents/tokens.ts";
import { type TaskGroup, toTaskGroup } from "../domain/task-group.ts";
import { exitOkWith, exitWithCode } from "../infra/exit.ts";
import { initProcLifecycle, withLifecycle } from "../infra/proc.ts";
import { getRoot, resolveDocArg } from "../infra/root.ts";
import { WorkspaceRoot } from "../infra/workspace.ts";
import { TemplateLoader } from "../render/templates.ts";
import { ConvergenceChecker } from "../rules/convergence.ts";
import { ResultFace } from "../rules/result-face.ts";
import { DRY_RUN, type PrevHandoff, requireHostHarness, resolveTargetDoc } from "./shared.ts";

const templates = new TemplateLoader();
const convergence = new ConvergenceChecker();
// C5 (T3): the single stdout result face — the docs review capsule + the `next:` suggestion line
// (status/blocker/handoff + next) derive through the injected StatusDeriver/NextStepRouter/Convergence
// (zero bare function emission; docsResultFace is retired).
const resultFace = new ResultFace();

export interface ReviewOpts {
  type: string;
  plan?: string;
  spec?: string;
  /** The dispatch group (P4.3/4.4) — the whole group reviews as one unit (TaskGroup value). */
  tasks?: number[] | TaskGroup;
  base?: string;
  head?: string;
  round?: string;
  root?: string;
  harness?: string;
}

interface RoundHandoff {
  status?: string;
  doc_path?: string;
  doc_hash?: string;
  blocker?: string;
  findings?: Array<{ severity?: string }>;
}

// ---- review-specific helpers ----

// Docs workspace fully routes through WorkspaceRoot.for(doc) → path
// (.kairos/cdd/<slug>/, slug derived via the slug rule; the Phase-0 flat root is retired,
// zero engine references).
export function existingRoundHandoff(ws: string, type: string, round: number): RoundHandoff | null {
  if (round < 1) return null;
  const p = path.join(ws, Handoff.handoffName("review", type, { round }));
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as RoundHandoff;
  } catch {
    // Cast a corrupt prev as "no prev" (fail-open: a corrupted prev must not lock re-review;
    // worst case one extra review round — never self-lock).
    // P4 robustness hardening: the diagnostic lands on stderr instead of being swallowed — when
    // a corrupt round-1 is ignored, why the re-dispatch did not trigger a Convergence lock is
    // transparent to the user.
    process.stderr.write(
      `CDD_INFO: corrupt prev handoff ${p} ignored → fail-open (new review round)\n`,
    );
    return null;
  }
}

// The `review --type task` task workspace derivation (the task derivation point: same-source slug
// as the dispatch's plan workspace). plan file name → WorkspaceRoot.for(plan).path — the slug rule
// (-design/-plan single-layer strip) and the base path converge via the WorkspaceRoot derivation
// (no hard-coded literal); the two derivation points' fork-prevention regression tests live in
// infra/__tests__/cli-shared.test.ts (§2.9 row 6 relocated — taskReviewWorkspace slug convergence).
// Exported as a test seam: repoRoot is injected by the caller.
export function taskReviewWorkspace(plan: string, repoRoot: string): string {
  return WorkspaceRoot.from(repoRoot).for(plan).path;
}

// ---- review dispatch ----

// Exported (test seam): cdd.test.mjs injects the docs-runner mock to assert DocsLifecycle args.
export async function runReview(opts: ReviewOpts): Promise<void> {
  return withLifecycle(async () => {
    // Host harness gate — the harness is no longer passed as a CLI param (T3); it is decided
    // from the environment host and threaded downward.
    const harness = requireHostHarness();
    // Root injection point (P4 §2.3.1 root injection contract): in-process callers may inject
    // root explicitly (no reset / env / ForTest seam); the black-box path falls back to the
    // initRoot()-initialized singleton. Every root consumer in this file uses it uniformly.
    const root = opts.root ?? getRoot();
    // type=branch: independent git-diff-level path (composite root inline — the former branch-review
    // bin action + AC15 wiring; cli/branch-review.ts was deleted — Criterion ⑤).
    if (opts.type === "branch") {
      if (!opts.plan) {
        process.stderr.write("cdd review --type branch: missing required --plan <path>\n");
        exitWithCode(2);
      }
      // --base/--head were requiredOption in the old branch-review bin; the inline keeps
      // that contract — missing values would otherwise render garbage ("undefin" file slugs  + undefined in return block).
      if (!opts.base || !opts.head) {
        process.stderr.write(
          "cdd review --type branch: missing required --base <sha> and --head <sha>\n",
        );
        exitWithCode(2);
      }
      // DRY_RUN() is a cli-module process-local — injected into the lifecycle at the boundary
      // (dispatch never reads it itself).
      const dryRun = DRY_RUN();
      const { BranchReviewLifecycle } = await import("../dispatch/branch.ts");
      const lc = new BranchReviewLifecycle({
        ...opts,
        plan: opts.plan,
        base: opts.base,
        head: opts.head,
        harness,
        dryRun,
        ctx: {
          mode: "branch-review",
          // C3-a (T6): seed the engine ctx with the RESOLVED root (line 95) — not `opts.root ??
          // null` — so the black-box path is always root-truthful and the base-default
          // docContractValidate never falls into its missing-root skip lane.
          repoRoot: root,
          dryRun,
        },
      });
      await lc.run();
      return;
    }

    if (opts.type === "spec" || opts.type === "plan") {
      // D11: type-self-describing target param — type=spec reviews the --spec doc;
      // type=plan reviews the --plan doc (optional --spec carries the upstream reference).
      const doc = resolveTargetDoc(opts, "review");
      const { DocsLifecycle } = await import("../dispatch/docs.ts");
      // spec/plan: round = engine auto-increment (canonical review.{type} family pattern scan);
      // --round only validates backfill (conflict → exit 2). The workspace materializes here
      // (WorkspaceRoot.ensure bootstrap guard + slug dir) — the docs agent's handoff writes land in
      // an already-guarded workspace.
      const workspaceRoot = WorkspaceRoot.from(root);
      workspaceRoot.ensure();
      const workspace = workspaceRoot.for(doc);
      workspace.ensure();
      const ws = workspace.path;
      // Process-lifecycle registry binding (T6 relocation, same as the task/branch lanes): the docs
      // review's registration lands in THIS slug's lifecycle.json — never the repo-level single file.
      initProcLifecycle({ diskPath: workspace.lifecyclePath });
      const round = Handoff.resolveNextRound(ws, "review", opts.type);
      if (opts.round && Number(opts.round) !== round) {
        process.stderr.write(`--round ${opts.round} ≠ engine round ${round}\n`);
        exitWithCode(2);
      }
      const prev = existingRoundHandoff(ws, opts.type, round - 1);
      // Convergence ref state binding point (§2.3.2): same path + same doc_hash → same ref (U1
      // hard stop); content evolution → new ref (auto-pass to a new round); legacy (no doc_hash)
      // → content state unknown → conservative hard stop (§2.2 bullet 3). BLOCKED/TIMEOUT failure
      // rounds pass without a hash check, silently (SP-4).
      if (prev && (prev.doc_path ?? "") === doc) {
        const docHash = hashFile(doc);
        const legacy = prev.doc_hash == null;
        const contentSame = !legacy && prev.doc_hash === docHash;
        if (legacy || contentSame) {
          convergence.reviewConvergenceGuard(prev, opts.type, round, doc, {
            reason: legacy ? "legacy" : "unchanged",
          });
        } else if (prev.status === "APPROVED" && docHash) {
          // Content evolution + an existing clean review → new ref → pass + self-documenting.
          // The empty docHash sentinel (ghost doc, §2.4) does NOT print CDD_INFO — a deleted
          // doc is not "evolution": silent pass, downstream fails naturally.
          process.stderr.write(
            `CDD_INFO: doc content changed since round-${round - 1} clean review (${prev.doc_hash!.slice(0, 8)} → ${docHash.slice(0, 8)}) → new review round ${round}\n`,
          );
        }
      }
      // Review template data-driven — spec/plan route through the docs-family shell (Task 20:
      // docs/review.md is gone; the unified constant shell is data-forced by the contract's
      // sections.return/round-context zones). REVIEW_REFERENCE injects the concrete doc path
      // (reviews.ref "doc vs spec" is a relational concept, analogous to how task/branch git-range
      // symbols get concrete-injected); content placeholders (lensEnum/axesGuide) inject from the
      // reviews config; artifact params (RETURN_FORMAT) read the canonical review.{type} family
      // (docs.ts recomputes RETURN_FORMAT/HANDOFF_WRITE_GATE as authoritative dispatch facts —
      // identical values here, matching for self-documentation). Round-context slots pre-fill
      // absent values with "" (mode-union template, no missing-param throw). `workspace` remains
      // in the options for the unit seam (cdd.test asserts it) — docs.ts ignores the key.
      const cfg = templates.reviewTypeConfig(opts.type);
      const art = templates.reviewArtifactConfig(opts.type);
      const handoffPath = path.join(ws, Handoff.handoffName("review", opts.type, { round }));
      const result = await DocsLifecycle.run({
        harness,
        mode: "review",
        template: "review",
        type: opts.type,
        doc,
        handoffPath,
        params: {
          MODE: "review",
          REVIEW_TYPE: opts.type,
          REVIEW_LENS_GUIDE: cfg.lensEnum.join(" · "),
          WORKSPACE: workspace.path,
          WORKSPACE_SLUG: workspace.slug,
          REVIEW_REFERENCE: doc,
          REVIEW_AXES: cfg.axesGuide,
          RETURN_FORMAT: art.returnFormat,
          // type=plan: REVIEW_PLAN_LINE injects the upstream spec reference; type=spec has no plan
          // reference, stays empty. The `**Spec:**` marker comes from the canonical token surface.
          REVIEW_PLAN_LINE:
            opts.type === "plan" && opts.spec ? `${DOC_TOKENS.specMark} ${opts.spec}` : "",
        },
        workspace: workspace.path,
        repoRoot: root,
        dryRun: DRY_RUN(),
      });
      // Docs review completion → stdout result face (C5, T3): the orchestrator routes on the single
      // capsule (`status: <judgment axis> · blocker: <own findings> · handoff: <path>`) without
      // opening the handoff; the `next:` suggestion line rides the same ResultFace emit (one-way →
      // fix when findings exist; `none` on a clean docs approval). Exit stays on the exit.ts single
      // surface: exit 0 → exitOkWith(face) one call; non-0 → face + exitWithCode.
      const docHandoff = result.handoff as
        | { status?: string; findings?: Array<{ severity?: string }> }
        | null
        | undefined;
      const faceOutput = resultFace
        .emit({
          op: "review",
          handoffPath,
          status: docHandoff?.status,
          findings: docHandoff?.findings,
          next: {
            op: "review",
            type: opts.type,
            doc,
            status: docHandoff?.status,
            findings: docHandoff?.findings,
            findingsPath: handoffPath,
          },
        })
        .join("\n");
      if (result.exitCode === 0) exitOkWith(faceOutput);
      process.stdout.write(`${faceOutput}\n`);
      exitWithCode(result.exitCode);
    }

    // type=task: task review (runner internally tracks tasks-{key}-review-{R}.json round sequence).
    if (opts.type !== "task") {
      process.stderr.write(`unknown review --type: ${opts.type}\n`);
      exitWithCode(2);
    }
    if (!opts.plan) {
      process.stderr.write(
        "cdd review --type task: missing required --plan <path> (workspace slug + Convergence)\n",
      );
      exitWithCode(2);
    }
    if (opts.tasks == null || opts.tasks.length === 0) {
      process.stderr.write("cdd review --type task: missing required --tasks <n|n,n,…>\n");
      exitWithCode(2);
    }
    // Workspace slug derives from the plan filename (workspaceSlug converges -design/-plan
    // single-layer strip); task Convergence reads the latest tasks-{a},{b}-review-{R}.json and
    // rejects when its blockers = 0. `--plan` second consumption point (read point ②): normalize
    // first via resolveDocArg (repo-root-relative → absolute) then derive the workspace — otherwise
    // the task workspace keeps a second coordinate system (cwd-relative).
    const taskPlan = resolveDocArg(opts.plan, root, "plan");
    const taskWs = taskReviewWorkspace(taskPlan, root);
    // The group is the dispatch unit — the group key pins the round scan (no subgroup mixing);
    // the task round derives via the canonical type-aware resolveNextRound (P4.3). P4.4: the key
    // IS the TaskGroup key (comma-joined — the CLI --tasks string, no second form).
    const group = toTaskGroup(opts.tasks);
    const groupKey = group.key();
    const nextTaskRound = Handoff.resolveNextRound(taskWs, "review", "task", {
      tasks: groupKey,
    });
    // --round validation backfill (task side: the derived next-round value; conflict → exit 2,
    // aligning spec/plan/branch).
    if (opts.round && Number(opts.round) !== nextTaskRound) {
      process.stderr.write(`--round ${opts.round} ≠ engine round ${nextTaskRound}\n`);
      exitWithCode(2);
    }
    if (nextTaskRound > 1) {
      const prevR = nextTaskRound - 1;
      // The review round's unique context (Task 6 ② RoundContext — round anchor): the same-family
      // round-(R-1) anchor derives the Convergence prev path (canonical review.task name →
      // tasks-{groupKey}-review-{prevR}.json). Must NOT use prevHandoffPath: that helper resolves
      // the cross-family prev table for this family (round1=implement / fix:R-1), which would read
      // the materialized implement APPROVED+[] → Convergence false lock.
      const prevRound = RoundContext.review(taskWs, "task", prevR, { tasks: groupKey });
      const th = JSON.parse(readFileSync(path.join(taskWs, prevRound.name), "utf8")) as PrevHandoff;
      convergence.reviewConvergenceGuard(th, "task", prevR, opts.plan); // only APPROVED+blocker=0 stops (SP-4)
    }
    const { TaskLifecycle } = await import("../dispatch/task.ts");
    await TaskLifecycle.run(harness, group, {
      mode: "review",
      dryRun: DRY_RUN(),
      planFile: opts.plan,
    });
  });
}
