// packages/cdd-engine/src/dispatch/branch.ts — BranchLifecycle family (P6 T24 A): the branch
// review/fix channels' ONE lifecycle class hierarchy. The flat bodies that lived in
// cli/branch-review.ts (runBranchReview) and cli/branch-fix.ts (runBranchFix) relocate into hook
// overrides of DispatchLifecycle (dispatch/base.ts): round/ref filename derivation, prompt assembly,
// schema validation, finalize and exit all become overridden hooks — the CLI wrappers build a
// lifecycle, run it, and map the outcome to the process exit. cli/branch-review.ts + branch-fix.ts
// become thin withLifecycle wrappers; the CLI surface ({ runBranchReview / runBranchFix } signatures
// + the 0/1/2 exit table + stderr diagnostics) is unchanged.
//
//   BranchReviewLifecycle  — `cdd review --type branch`: per-ref round seq (AC15, ref embedded in
//     the file name) + --round backfill validation + Review Convergence prev read; the review-finalize
//     read-back. Overrides commitPostCheck no-op (a review writes no code; the commit contract is
//     the FIX channel's — no exit gate on review).
//   BranchFixLifecycle     — `cdd fix --type branch`: round/ref derived from the SOURCE review's
//     file name; FIX_BASE = the source review's commits.base; closes the loop through the INHERITED
//     default commitPostCheck (validateCommitContract — the fix channel commits, its dirty/head
//     contract must hold).
//
// Gate contract (branch family): commitPreCheck (the entry gate) is NOT part of branch semantics —
// branch rounds are ref-driven and never gate on the pre-commit clean tree, so BranchLifecycle
// overrides it no-op (documented below; the fix channel's working-tree contract is the exit gate).
//
// Layer note: this module lives in the dispatch layer — reviewConvergenceGuard comes from its owner
// rules/convergence.ts (NOT the cli/shared.ts re-export), return-block atoms from
// artifacts/return-block.ts, and the dry-run flag is INJECTED by the CLI wrapper (DRY_RUN() is a
// cli-module process-local; this module never reads it from elsewhere). Zero upward cli imports.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  finalizeHandoff,
  recoverHandoff,
  writeBlockedCarrier,
} from "../artifacts/handoff/finalize.ts";
import * as handoffNaming from "../artifacts/handoff/naming.ts";
import { readJson, writeHandoff, writeOwnHandoff } from "../artifacts/handoff/write.ts";
import { ResidueManager } from "../artifacts/residue.ts";
import { exitOk, exitWithCode } from "../infra/exit.ts";
import { EngineInvoker } from "../infra/invoke.ts";
import { CddBlockedError, REG_PATH, Registry } from "../infra/registry.ts";
import { getRoot, resolveDocArg } from "../infra/root.ts";
import { TemplateLoader } from "../render/templates.ts";
import { ConvergenceChecker } from "../rules/convergence.ts";
import { FAILURE_CATEGORIES } from "../rules/failure.ts";
import { type NextStepArgs, NextStepRouter, SOFT_CAP_S1_ROUNDS } from "../rules/next-step.ts";
import { maxConsecutiveS1Rounds } from "../rules/ref-sequence.ts";
import { ResultFace } from "../rules/result-face.ts";
import { HandoffSchemaValidator } from "../rules/schema.ts";
import { type DispatchContext, type DispatchHookContext, DispatchLifecycle } from "./base.ts";

const registry = new Registry();
const invoker = new EngineInvoker();
const templates = new TemplateLoader();
const convergence = new ConvergenceChecker();
const schema = new HandoffSchemaValidator();
const residue = new ResidueManager();
// C5 (T3): the single stdout capsule face — one ResultFace for branch review/fix (status/blocker/
// handoff + the `next:` line through the injected router; the former 5-line assembleReturnBlock /
// returnFromHandoff emissions are retired).
const nextRouter = new NextStepRouter();
const resultFace = new ResultFace({ nextRouter });

// ---- public opts (the CLI surface's derivation contract; moved from cli/branch-review.ts / fix) ----

/** Internal common opts — `dryRun` is REQUIRED here (injected by the CLI wrapper); the public
 * BranchReviewOpts / BranchFixOpts surfaces (runBranchReview / runBranchFix params) do NOT carry
 * it, preserving the cli caller contract — the wrapper supplies it at construction. */
export interface BranchLifecycleOpts {
  plan: string;
  harness: string;
  type: string;
  root?: string;
  registryPath?: string;
  dryRun: boolean;
}

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

export interface BranchFixOpts {
  plan: string;
  findings: string;
  harness: string;
  type: string;
  root?: string;
  registryPath?: string;
}

// The invoke result lanes the branch channels read (SpawnResult subset).
interface BranchInvokeResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** BranchLifecycle — the branch family's shared base: the entry-gate no-op + the registry ship gate
 * (spec step 1) + the derived state the two channels share. Terminal decisions leave via the exit
 * helpers (exitWithCode throws ExitRequested — the bin maps it; a terminal throw aborts the
 * template mid-run and post-terminal hooks never fire). */
export abstract class BranchLifecycle extends DispatchLifecycle {
  protected readonly opts: BranchLifecycleOpts;
  protected entry: {
    cli: string;
    invoke: string;
    output?: string;
    prefix?: unknown;
    suffix?: unknown;
  } | null = null;
  protected repoRoot = "";
  protected workspace = "";
  protected handoffPath = "";
  /** invoke result code of the just-finished agent dispatch (schemaValidate reads it for the
   * failure-without-handoff lanes). */
  protected agentRc = 0;
  /** the schema-validated / recovered handoff (schemaValidate → normalizeResult handoff). */
  protected agentHandoff: Record<string, unknown> | null = null;
  /** post-finalization exit code — normalizeResult stores it; the fix wrapper emits it AFTER the
   * inherited exit gate ran (the gate failure rewrites the handoff and exits 1 before this is
   * read; the review wrapper never reads it — review's normalizeResult exits immediately). */
  protected finalExitCode = 0;

  /** The stored round conclusion (post-run read for the fix wrapper's exit). */
  get exitCode(): number {
    return this.finalExitCode;
  }

  constructor(options: BranchLifecycleOpts & { ctx: DispatchContext }) {
    const { ctx, ...opts } = options;
    super({ ctx });
    this.opts = { ...opts };
  }

  /** Branch-family entry gate: NO-OP — branch review/fix rounds are ref-driven and never gate on
   * the pre-commit clean tree (the former cli flat bodies ran none). The working-tree contract of
   * the fix channel lives at the EXIT gate (inherited default commitPostCheck). */
  protected override async commitPreCheck(_hookCtx: DispatchHookContext): Promise<void> {}

  /** Lane-declared doc-audit target (T3 ④「lane 声明审计对象」): the branch channel audits its
   * `--plan` ref (the same plan the review/fix round derives its workspace from) — the base default
   * docContractValidate walks plan → `**Spec:**` → Parent program → overall and gates on the
   * parent-overall four tables when the lineage resolves. */
  protected override docAuditTarget(): string | null {
    if (!this.opts.plan) return null;
    try {
      return resolveDocArg(this.opts.plan, this.repoRoot, "plan");
    } catch {
      return this.opts.plan; // an unresolvable ref → the audit fail-opens on the raw path
    }
  }

  /** Plan-bearing declaration (P2 T4): the branch lane is ALWAYS plan-bearing — the closeout
   * terminal-debt hard gate and the base-default statusValidate key off its `--plan` ref (v1.12:
   * the v1.11 lane boundary is rescinded — branch-review's precondition IS the ended plan, so its
   * backfill obligation is already due and the gate is the correct behavior). */
  protected override dispatchPlanPath(): string | null {
    return this.docAuditTarget();
  }

  /** Doc-contract BLOCK face (T3 ④): the branch terminal convention — stderr CDD_BLOCKED +
   * exitWithCode(1) (exit helpers throw ExitRequested, the bin maps the exact code; the default
   * DispatchBlocked throw would escape the wrappers' gate filters and land on exit 2). */
  protected override docContractBlocked(guidance: string): void {
    process.stderr.write(
      `CDD_BLOCKED: doc contract validation failed — fix the docs below:\n${guidance}\n`,
    );
    exitWithCode(1);
  }

  /** Registry ship gate (spec step 1): resolve the harness entry + dry-run-path CLI-existence
   * check. Failure → the message on stderr + the kind's exit code (cli-missing → 2, blocked → 1;
   * the CLI 0/1/2 table preserved — CddBlockedError.exitCode IS that code). A non-CddBlockedError
   * registry failure (e.g. corrupt registry JSON) rethrows to the caller surface. */
  protected registryGate(): void {
    try {
      this.entry = registry.checkHarness(
        registry.load(this.opts.registryPath ?? REG_PATH),
        this.opts.harness,
        {
          dryRun: this.opts.dryRun,
        },
      );
    } catch (e) {
      if (e instanceof CddBlockedError) {
        process.stderr.write(`${e.message}\n`);
        exitWithCode(e.exitCode);
      }
      throw e;
    }
  }

  /** BLOCKED-carrier commits — only when the base satisfies the schema's `^[0-9a-f]{40}$`: a
   * short-form base is carried by the AC15 base7..head7 file name, and a BLOCKED payload must
   * always pass its own validation. head included only when present (branch-review carries the
   * reviewed range head; branch-fix has no head yet). */
  protected branchCarrierCommits(base: string, head?: string): Record<string, unknown> | undefined {
    const fullBase = typeof base === "string" && /^[0-9a-f]{40}$/.test(base) ? base : null;
    if (!fullBase) return undefined;
    return { base: fullBase, ...(typeof head === "string" && head ? { head } : {}) };
  }

  /** Shared schema-validate lane (single implementation for both branch channels — the former two
   * hook bodies were structurally identical parallel implementations of the same sequence; one
   * helper keeps the agent-failure / no-handoff / schema-recovery lanes from drifting between
   * branch-review and branch-fix). Every lane writes the BLOCKED carrier and exits 1; on recovery
   * the normalized handoff replaces the agent's file. `phase` is the handoff phase field, `label`
   * the channel word in the CDD_BLOCKED diagnostics, `reRun` the re-run command phrase in the
   * blockers, `commits` the channel's BLOCKED-carrier commits subset. T25: the execution-failure
   * lane records the death diagnosis (recovery.cause + exit_code) and preserves the dirty-tree
   * residue INLINE (these lanes abort via exitWithCode — the template post-flight settleResidue
   * step never fires on the branch channel). */
  protected async schemaValidateBranch(options: {
    phase: string;
    label: string;
    reRun: string;
    commits?: Record<string, unknown>;
  }): Promise<void> {
    const { phase, label, reRun, commits } = options;

    // Nested CLI failed with no handoff → write BLOCKED handoff + CDD_BLOCKED diagnostic + exit 1
    // (mirrors runner step 10). T25: residue preserved inline (stash-workflow contract — retrieve
    // via `git stash list`, salvage or discard) instead of the pre-destroying discard-or-commit
    // advice; SIGTERM (143) is annotated so the death cause is replayable from the blocker.
    if (this.agentRc !== 0 && !existsSync(this.handoffPath)) {
      writeBlockedCarrier(this.handoffPath, {
        tasks: [1],
        phase,
        failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
        ...(commits ? { commits } : {}),
        recovery: { cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id, exit_code: this.agentRc },
        blocker: `cli exited ${this.agentRc}${this.agentRc === 143 ? " (SIGTERM — externally killed)" : ""} without writing handoff → worktree residue is preserved as a stash (\`git stash list\` → \`git stash apply <ref>\` → review → commit to salvage or \`git stash drop\` to discard) → re-run ${reRun}`,
      });
      process.stderr.write(`CDD_BLOCKED: ${label} failed (exit ${this.agentRc})\n`);
      await residue.preserveAndAnnounceResidue(this.repoRoot, this.handoffPath, this.repoRoot);
      exitWithCode(1);
    }

    // Agent exited 0 but never wrote the handoff — BLOCKED (mirrors runner step 10.5).
    if (!existsSync(this.handoffPath)) {
      writeBlockedCarrier(this.handoffPath, {
        tasks: [1],
        phase,
        failure_category: FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
        ...(commits ? { commits } : {}),
        blocker: `${path.basename(this.handoffPath)} not written after exit 0 → re-run ${reRun}`,
      });
      process.stderr.write(`CDD_BLOCKED: ${label} handoff not written\n`);
      exitWithCode(1);
    }

    // Agent wrote handoff — validate against the CDD task schema (mirrors runner step 8.8; T5
    // CONTRACT_VIOLATION recovery: normalize → re-validate at most one round, findings preserved).
    // T8 hardening (docs.ts single-point mirror; P4 dogfood): an unparseable agent handoff must
    // not propagate as a bare JSON.parse throw (bin.ts's non-CLIError path would exit 2 with the
    // corrupt file left on disk and no BLOCKED carrier / round signal) — degrade to the same
    // BLOCKED-write branch as "not written / schema invalid".
    let agentHandoff: Record<string, unknown>;
    try {
      agentHandoff = JSON.parse(readFileSync(this.handoffPath, "utf8")) as Record<string, unknown>;
    } catch (e) {
      writeBlockedCarrier(this.handoffPath, {
        tasks: [1],
        phase,
        failure_category: FAILURE_CATEGORIES.CONTRACT_VIOLATION.id,
        ...(commits ? { commits } : {}),
        blocker: `${label} handoff JSON unparseable: ${(e as Error).message} → fix the handoff at ${this.handoffPath} and re-run ${reRun}`,
      });
      process.stderr.write(`CDD_BLOCKED: ${label} handoff JSON unparseable\n`);
      exitWithCode(1);
    }
    let handoff: Record<string, unknown> = agentHandoff;
    const sv = schema.validateHandoffSchema(agentHandoff, "task");
    if (!sv.valid) {
      // Recovery single point = finalize.ts#recoverHandoff (normalize → re-validate, one round
      // max; the violating-key suffix + findings array guard are written there once — this lane
      // keeps only its own failure-payload difference).
      const rec = recoverHandoff(agentHandoff, "task");
      if (!rec.valid) {
        // C4-3 (T7, following #306's guidance call): the still-failing face's blocker carries the
        // violating FIELD NAME (the rec.reason suffix — the engine-authored `(unexpected key: X)`
        // / the ajv detail) + the EXPECTED SHAPE of a valid receipt + the fix-and-re-run phrase in
        // the same sentence. Agents that lost the writable-subset message (C4-2) get the
        // contract back here.
        writeBlockedCarrier(this.handoffPath, {
          tasks: [1],
          phase,
          failure_category: FAILURE_CATEGORIES.CONTRACT_VIOLATION.id,
          ...(commits ? { commits } : {}),
          findings: rec.preservedFindings,
          blocker: `${label} handoff schema invalid${rec.reason} — expected handoff shape: phase (implement|review|fix|branch-review) · status (APPROVED|BLOCKED|CHANGES_REQUESTED|REVIEW_FIX|TIMEOUT) · commits { base, head? } 40-hex · artifacts {} · findings [] · changes[] · notes string — NO unknown keys ('$schema' / 'review_scope' are engine-stamped, never authored) → fix the handoff JSON at ${this.handoffPath} and re-run ${reRun}`,
          fullReplace: true, // violating keys never stay on disk
        });
        process.stderr.write(`CDD_BLOCKED: ${label} handoff schema invalid\n`);
        exitWithCode(1);
      }
      writeOwnHandoff(this.handoffPath, rec.handoff);
      handoff = rec.handoff;
    }
    this.agentHandoff = handoff;
  }
}

/** BranchReviewLifecycle — `cdd review --type branch` (AC15 round sequence + Review Convergence:
 * previous-round lookup filtered by the base7..head7 embedded in the file name; a ref change = a
 * new review, never falsely rejected). */
export class BranchReviewLifecycle extends BranchLifecycle {
  readonly #base: string;
  readonly #head: string;

  constructor(options: BranchReviewOpts & BranchLifecycleOpts & { ctx: DispatchContext }) {
    super(options);
    this.#base = options.base;
    this.#head = options.head;
  }

  /** Round/ref derivation: per-ref round seq (resolveNextRound over the concrete base7/head7) +
   * --round backfill validation (conflict → exit 2) + Convergence prev read (canonical
   * prevHandoffPath concrete-matches the same ref) + the per-round handoff filename + workspace
   * bootstrap. */
  protected override async resolveContext(_hookCtx: DispatchHookContext): Promise<void> {
    this.registryGate();

    // Root single authority (src/infra/root.ts): initRoot() already performed the "not a git repo
    // → BLOCKED exit 1" ruling in bin's preAction, so no guard here. Root injection contract
    // (P4 §2.3.1): in-process callers inject root via opts.root; the black-box path falls back to
    // the initRoot()-initialized singleton.
    this.repoRoot = this.opts.root ?? getRoot();
    const base = String(this.#base);
    const head = String(this.#head);
    const base7 = base.slice(0, 7);
    const head7 = head.slice(0, 7);
    // Workspace same-source with the other review types: resolveWorkspace(plan)
    // (.osuperpowers/cdd/<slug>/).
    this.workspace = handoffNaming.resolveWorkspace(this.opts.plan, this.repoRoot);

    // AC15 wiring: per-ref round seq + --round backfill validation (other refs' rounds never
    // interfere with this one) + Convergence reads the previous round.
    const round = handoffNaming.resolveNextRound(this.workspace, "review", "branch", {
      base7,
      head7,
    });
    if (this.opts.round && Number(this.opts.round) !== round) {
      process.stderr.write(`--round ${this.opts.round} ≠ engine round ${round}\n`);
      exitWithCode(2);
    }
    const prevPath = handoffNaming.prevHandoffPath(this.workspace, "review", "branch", round, {
      base7,
      head7,
    });
    let prev: Record<string, unknown> | null = null;
    if (prevPath && existsSync(prevPath)) {
      try {
        prev = JSON.parse(readFileSync(prevPath, "utf8")) as Record<string, unknown>;
      } catch {
        // Corrupt prev → fail-open (mirror cli/review.ts existingRoundHandoff): a corrupt
        // previous-round handoff must not lock re-review — worst case one extra review round,
        // never self-lock. The diagnostic lands on stderr instead of being swallowed so why the
        // re-dispatch did not trigger a Convergence lock stays transparent to the user.
        process.stderr.write(
          `CDD_INFO: corrupt prev branch handoff ${prevPath} ignored → fail-open\n`,
        );
        prev = null;
      }
    }
    // Stop only on an APPROVED round with blocker=0 (SP-4) — a BLOCKED/TIMEOUT branch review
    // round with findings:[] must be re-dispatchable, not rejected as "already done".
    if (prev) convergence.reviewConvergenceGuard(prev, "branch", round, `${base7}..${head7}`);

    // Per-round handoff filename (canonical review.branch family; branch-fix re-reviews reuse
    // distinct files).
    this.handoffPath = path.join(
      this.workspace,
      handoffNaming.handoffName("review", "branch", { base7, head7, round }),
    );
    mkdirSync(this.workspace, { recursive: true });
  }

  /** Steps 7/8: render the branch-review prompt (docs-family shell + REVIEW_REFERENCE
   * base..head + review-family round-context slots) and spawn the harness CLI. Dry-run:
   * APPROVED stub handoff + the single stdout capsule (ResultFace — status/blocker/handoff + the
   * C5 `next:` line) + exit 0. */
  protected override async dispatch(_hookCtx: DispatchHookContext): Promise<void> {
    const base = String(this.#base);
    const head = String(this.#head);

    if (this.opts.dryRun) {
      writeHandoff(this.handoffPath, {
        tasks: [1],
        phase: "branch-review",
        status: "APPROVED",
        commits: { base, head },
        findings: [],
        artifacts: {},
      });
      const lines = resultFace.emit({
        op: "review",
        handoffPath: this.handoffPath,
        status: "APPROVED",
        findings: [],
        // C5 (T8): the branch-review dry-run is a clean round (zero findings) → the approval is a
        // terminal `next: none` (a branch review has no remaining-group hop).
        next: {
          op: "review",
          type: "branch",
          plan: this.opts.plan,
          status: "APPROVED",
          findings: [],
        },
      });
      for (const line of lines) process.stdout.write(`${line}\n`);
      exitOk();
      return;
    }

    const cfg = templates.reviewTypeConfig("branch");
    const art = templates.reviewArtifactConfig("branch");
    const prompt = templates.renderTemplate(
      "review",
      {
        MODE: "review",
        REVIEW_TYPE: "branch",
        WORKSPACE: this.workspace,
        WORKSPACE_SLUG: path.basename(this.workspace),
        REVIEW_LENS_GUIDE: cfg.lensEnum.join(" · "),
        REVIEW_REFERENCE: `${base}..${head}`,
        REVIEW_AXES: cfg.axesGuide,
        HANDOFF_TARGET: this.handoffPath,
        RETURN_FORMAT: art.returnFormat,
        REVIEW_PLAN_LINE: this.opts.plan ? `**Plan:** ${this.opts.plan}` : "",
        HANDOFF_WRITE_GATE: templates.reviewHardGate(art.returnFormat, this.handoffPath),
      },
      "cdd review",
    );

    // Invoke harness CLI. (op,type) injection resolves into prefix.review.branch (the old
    // branch-review standalone bin is deleted, its logic inlined here). T26 unified termination
    // (single resolver — budget from canonical review defaults, stall over the workspace tree).
    const terminationCfg = invoker.resolveTerminationConfig("review", undefined, this.workspace);
    const res = (await invoker.invokeCliWithRetry(
      this.entry!,
      prompt,
      { op: "review", type: "branch" },
      process.env,
      this.repoRoot,
      terminationCfg,
    )) as BranchInvokeResult;
    this.agentRc = res.code;
  }

  /** Steps 8.8/10/10.5: agent-failure / no-handoff lanes (BLOCKED carrier writes) + schema
   * recovery + the review-family finalization read-back. */
  protected override async schemaValidate(_hookCtx: DispatchHookContext): Promise<void> {
    const base = String(this.#base);
    const head = String(this.#head);
    await this.schemaValidateBranch({
      phase: "branch-review",
      label: "branch-review",
      reRun: "branch-review",
      commits: this.branchCarrierCommits(base, head),
    });
  }

  /** Status single authority (T5/T7) — branch review (review family) reads back through finalizeHandoff
   * finalization (rollup derived override, SP-4 exempts failure rounds); the finalized write uses
   * writeOwnHandoff (the engine is the carrier's sole author, full-replace). The three consumers
   * (runner/docs-runner/cdd) share the same finalizeHandoff single point.
   * The exit comes from the finalized round conclusion (Task 23 ③: BLOCKED → 1,
   * APPROVED/CHANGES_REQUESTED → 0) — this is the sole exit path once the agent wrote a handoff.
   * The REAL-mode round ALSO emits the single stdout capsule on the parent stdout (T6 C3-b / C5 T3)
   * — via the one ResultFace (status/blocker/handoff + the `next:` line): the orchestrator routes
   * the branch-review round on the capsule's status. A BLOCKED review (or a null handoff) produces
   * no `next:` (the failure-mode stderr face owns it). */
  protected override async normalizeResult(_hookCtx: DispatchHookContext): Promise<void> {
    const base = String(this.#base);
    const head = String(this.#head);
    const finalized = await finalizeHandoff({ mode: "review", agentHandoff: this.agentHandoff });
    let handoff = finalized.handoff;
    // Unified lifecycle contract: branch-review handoffs carry commits{base,head} — branch-fix
    // derives FIX_BASE from the source review's commits.base. The review agent's handoff may omit
    // the field; stamp the CLI's reviewed range so the review→fix loop closes (same shape as the
    // dry-run / BLOCKED-carrier lanes).
    if (
      handoff &&
      typeof handoff === "object" &&
      (handoff as { commits?: unknown }).commits === undefined
    ) {
      const cc = this.branchCarrierCommits(base, head);
      if (cc) handoff = { ...handoff, commits: cc };
    }
    if (handoff && handoff !== this.agentHandoff) writeOwnHandoff(this.handoffPath, handoff);
    const reviewHandoff = handoff as {
      status?: string;
      findings?: Array<{ severity?: string }>;
    } | null;
    const lines = resultFace.emit({
      op: "review",
      handoffPath: this.handoffPath,
      status: reviewHandoff?.status,
      findings: reviewHandoff?.findings,
      next: reviewHandoff
        ? {
            op: "review",
            type: "branch",
            plan: this.opts.plan,
            base: String(this.#base),
            head: String(this.#head),
            status: reviewHandoff.status,
            findings: reviewHandoff.findings,
            findingsPath: this.handoffPath,
          }
        : undefined,
    });
    for (const line of lines) process.stdout.write(`${line}\n`);
    exitWithCode(finalized.exitCode);
  }

  /** Review-family exit gate: NO-OP — a review writes no code, there is no commit contract to
   * validate (the branch-fix channel inherits the base default instead). */
  protected override async commitPostCheck(_hookCtx: DispatchHookContext): Promise<void> {}
}

/** BranchFixLifecycle — `cdd fix --type branch` (spec E2①): the branch review→fix loop's fix
 * channel. The fix round + ref derive from the SOURCE branch-review handoff's file name (same
 * round/ref as the source — same convention as the task/spec/plan fix families); FIX_BASE = the
 * source review's commits.base (the reviewed range base). Closes the loop through the INHERITED
 * default exit gate (validateCommitContract — dirty tree → BLOCKED rewrite; clean tree +
 * commits.head ≠ HEAD → BLOCKED, F1). */
export class BranchFixLifecycle extends BranchLifecycle {
  #base7 = "";
  #head7 = "";
  #fixRound = 0;
  /** the derived FIX_BASE (source review's commits.base — the reviewed range base). */
  protected fixBase = "";
  /** the resolved source-review path (the `--findings` input) — the C5-1 next-hop judge reads the
   *  `--findings` INPUT content, never the fix's own carrier (set in resolveContext). */
  protected findingsPath = "";

  constructor(options: BranchFixOpts & BranchLifecycleOpts & { ctx: DispatchContext }) {
    super(options);
  }

  /** Round/ref derivation from the source review file name (the --findings path). The findings
   * name must mirror the source's ref + round: the ref segments are re-derived from the SAME
   * canonical family template with capturing groups (identical placeholder substitution rules as
   * roundPattern → the config name stays the single truth). Group order: [1]=base7 [2]=head7
   * [3]=round. A non-matching findings name → usage error exit 2 (before any path resolution — the
   * guard order contract, §2.4.2); a fixRound < 1 → usage error exit 2. */
  protected override async resolveContext(_hookCtx: DispatchHookContext): Promise<void> {
    this.registryGate();

    // Root single authority (same injection contract as the review channel): opts.root wins; the
    // black-box path falls back to the initRoot()-initialized singleton.
    this.repoRoot = this.opts.root ?? getRoot();
    this.workspace = handoffNaming.resolveWorkspace(this.opts.plan, this.repoRoot);

    const findingsBase = path.basename(this.opts.findings);
    const refRoundRe = new RegExp(
      "^" +
        handoffNaming
          .familyConfig("review", "branch")
          .name.replace("{round}", "(\\d+)")
          .replace("{base7}", "([0-9a-f]{7})")
          .replace("{head7}", "([0-9a-f]{7})")
          .replaceAll(".", "\\.") +
        "$",
    );
    const refRound = findingsBase.match(refRoundRe);
    if (!refRound) {
      process.stderr.write(
        `cdd fix --type branch: --findings must name a branch-review-{base7}..{head7}-r{R}.json file (round + ref derived from the source review); got: ${this.opts.findings}\n`,
      );
      exitWithCode(2);
    }
    this.#base7 = refRound[1]!;
    this.#head7 = refRound[2]!;
    this.#fixRound = Number(refRound[3]);
    if (!Number.isInteger(this.#fixRound) || this.#fixRound < 1) {
      process.stderr.write(
        `cdd fix --type branch: --findings round must be >= 1 (round derived from the source review); got: ${this.opts.findings}\n`,
      );
      exitWithCode(2);
    }
    // Canonical fix.branch family name — same ref + same round as the source review (the `round`
    // family's "source" semantics: the fix round is copied from the review it sources).
    this.handoffPath = path.join(
      this.workspace,
      handoffNaming.handoffName("fix", "branch", {
        base7: this.#base7,
        head7: this.#head7,
        round: this.#fixRound,
      }),
    );
    // Thread the derived handoff path AND the resolved root into the engine context: the inherited
    // exit gate (commitPostCheck → validateCommitContract) reads both from ctx — without them the
    // F1 head-mismatch BLOCKED and the dirty-tree BLOCKED-carrier rewrite both silently no-op. The
    // CLI wrapper seeds ctx.repoRoot = opts.root ?? null while all three command faces (implement /
    // review / fix) declare --root (cli/parse.ts) — on a production walk without --root the wrapper's
    // seed alone stays null and would leave the gate fail-open; threading the resolved this.repoRoot
    // (opts.root ?? getRoot()) here closes it — the docs-channel precedent
    // (dispatch/docs.ts resolveContext).
    this.ctx = { ...this.ctx, handoffPath: this.handoffPath, repoRoot: this.repoRoot };
  }

  /** Steps 7/8: derive the FIX_BASE (source review's commits.base; missing/unknown → BLOCKED
   * carrier + exit 1), render the fix prompt (task-family shell + RETURN_STDOUT_BLOCK), spawn the
   * fix agent CLI. Dry-run: APPROVED stub handoff + the single stdout capsule (ResultFace —
   * status/blocker/handoff + the C5 `next:` line) + exit 0. */
  protected override async dispatch(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.opts.dryRun) {
      writeHandoff(this.handoffPath, {
        tasks: [1],
        phase: "fix",
        status: "APPROVED",
        commits: { base: "dry-run", head: "dry-run" },
        findings: [],
        artifacts: {},
      });
      const lines = resultFace.emit({
        op: "fix",
        handoffPath: this.handoffPath,
        status: "APPROVED",
        findings: [],
        // C5 (T8): dry-run fix input has zero findings → zero blockers → closure `next: none`.
        next: {
          op: "fix",
          type: "branch",
          plan: this.opts.plan,
          status: "APPROVED",
          findings: [],
        },
      });
      for (const line of lines) process.stdout.write(`${line}\n`);
      exitOk();
      return;
    }

    // Non-dry-run: normalize --findings (repo-root-relative → absolute; missing → exit 1
    // three-line diagnostic — AFTER the round-derivation guard) and read the FIX_BASE = the source
    // review's commits.base (the reviewed range base). Missing scan file → still norm it (a path
    // miss is the caller's coordinate error, exit 1); missing/unknown commits.base → BLOCK (no base
    // = the fix range is underivable, and the fix handoff must declare commits.base for the exit
    // gate).
    const findingsPath = resolveDocArg(this.opts.findings, this.repoRoot, "findings");
    // C5-1 (T9 fix): the source-review INPUT path — the fix face derives the return block's `next:`
    // from the `--findings` content (never the fix's own carrier). Stored on the real lane only:
    // the round-derivation guard ran before this point (exit 2 on a non-matching name) and the
    // dry-run lane exits earlier (dispatch emits the stub block itself).
    this.findingsPath = findingsPath;
    const src = readJson(findingsPath);
    const fixBase = src?.commits?.base as string | undefined;
    if (!fixBase || fixBase === "unknown") {
      writeBlockedCarrier(this.handoffPath, {
        tasks: [1],
        phase: "fix",
        failure_category: FAILURE_CATEGORIES.CONTRACT_VIOLATION.id,
        blocker: `source review handoff ${findingsPath} has no valid commits.base → cannot derive the fix BASE; fix the source review and re-run cdd fix --type branch`,
      });
      process.stderr.write(`CDD_BLOCKED: branch-fix source review missing commits.base\n`);
      exitWithCode(1);
    }
    this.fixBase = fixBase;

    // The fix prompt: task-family shell + RETURN_STDOUT_BLOCK return (the fix agent writes the
    // handoff + the return block; task-family round-context slots minus DISPATCH_UNIT/CONSTRAINTS
    // — empty for the branch family; BRIEF carries the plan path as the branch-level brief).
    const prompt = templates.renderTemplate(
      "fix",
      {
        MODE: "fix",
        WORKSPACE: this.workspace,
        WORKSPACE_SLUG: path.basename(this.workspace),
        FINDINGS: findingsPath,
        FIXED_POINT: fixBase,
        BRIEF: this.opts.plan,
        HANDOFF_TARGET: this.handoffPath,
        REVIEW_PLAN_LINE: this.opts.plan ? `**Plan:** ${this.opts.plan}` : "",
        RETURN_FORMAT: "RETURN_STDOUT_BLOCK",
        HANDOFF_WRITE_GATE: templates.reviewHardGate("RETURN_STDOUT_BLOCK", this.handoffPath),
      },
      "cdd fix",
    );

    // Invoke the harness CLI. (op,type) injection resolves the flat `prefix.fix` string
    // (/mattpocock-skills:tdd — the fix channel is work-type, not per-type). T26 unified
    // termination (single resolver — same surface as task/docs/branch-review).
    const terminationCfg = invoker.resolveTerminationConfig("review", undefined, this.workspace);
    const res = (await invoker.invokeCliWithRetry(
      this.entry!,
      prompt,
      { op: "fix", type: "branch" },
      process.env,
      this.repoRoot,
      terminationCfg,
    )) as BranchInvokeResult;
    this.agentRc = res.code;
  }

  /** Steps 8.8/10/10.5: agent-failure / no-handoff lanes + schema recovery (the commit-contract
   * BLOCKED rewrite rides the inherited exit gate in the next step). BLOCKED carrier commits carry
   * ONLY the FIX_BASE when 40-hex — a BLOCKED fix has no head yet (mirror of the former
   * writeBranchFixBlocked shape). */
  protected override async schemaValidate(_hookCtx: DispatchHookContext): Promise<void> {
    await this.schemaValidateBranch({
      phase: "fix",
      label: "branch-fix",
      reRun: "cdd fix --type branch",
      commits: this.branchCarrierCommits(this.fixBase),
    });
  }

  /** Finalize through the single finalization point. C4 (T7): the branch-fix closing handoff is
   * engine fact reconstruction (finalizeFix) — commits (git facts: base = this.fixBase, head =
   * git HEAD) + phase + status (commit-contract judgment) authoritative, the agent handoff input
   * only; a fix that advanced HEAD past the FIX_BASE with no code-face error self-heals to
   * APPROVED (no hard gate on the receipt shape — #307), the truly failing faces (no commit /
   * code-face error) stay BLOCKED. Task 23 ③: the fix round conclusion → exit (BLOCKED → 1,
   * APPROVED/CHANGES_REQUESTED → 0) — captured here, emitted by the wrapper AFTER the (inherited)
   * exit gate ran clean.
   * C5 (T3): the branch-fix stdout capsule is DERIVED here — the `next:` suggestion (the fix face
   * is the re-review/closure single decision point, judged on the `--findings` INPUT content:
   * blockers → re-review on the moved ref / warn+nit → closure / BLOCKED → no next line) — and
   * SURFACED by the CLI wrapper on the parent stdout after run() returns (the exit gate ran first)
   * via this.returnBlock (which re-reads the finalized carrier from disk). */
  protected override async normalizeResult(_hookCtx: DispatchHookContext): Promise<void> {
    const finalized = await finalizeHandoff({
      mode: "fix",
      agentHandoff: this.agentHandoff,
      fixBase: this.fixBase,
      repoRoot: this.repoRoot,
    });
    if (finalized.handoff && finalized.handoff !== this.agentHandoff)
      writeOwnHandoff(this.handoffPath, finalized.handoff);
    this.finalExitCode = finalized.exitCode;
  }

  /** C5-1: the branch-fix `--findings` INPUT findings (the capsule blocker + next-hop source —
   *  never the fix's own carrier). Non-array `findings` on the input (a documented agent-written
   *  shape) degrades to the 0-blocker baseline. */
  #inputFindings(): Array<{ severity?: string }> {
    const inputHandoff = readJson(this.findingsPath) as {
      findings?: Array<{ severity?: string }>;
    } | null;
    return Array.isArray(inputHandoff?.findings) ? inputHandoff.findings : [];
  }

  /** C5-1 (T9 fix): the branch-fix `next:` derivation input — the fix face's re-review/closure
   *  single decision point. Read the `--findings` INPUT content (never the fix's own carrier),
   *  mirror cli/fix.ts docs face: blocker present → re-review on the moved ref (the fix base..its
   *  git HEAD); warn/nit-only → closure `none`; the fix round's own BLOCKED/TIMEOUT conclusion →
   *  no `next:` (the failure-mode stderr face owns it). softCap via the ref-sequence walk (same
   *  basis as the task and docs fix faces). */
  #fixNextArgs(handoff: Record<string, unknown> | null): NextStepArgs | undefined {
    const commits = (handoff?.commits as Record<string, unknown> | undefined) ?? {};
    return {
      op: "fix",
      type: "branch",
      plan: this.opts.plan,
      base: typeof commits.base === "string" ? commits.base : undefined,
      head: typeof commits.head === "string" ? commits.head : undefined,
      status: typeof handoff?.status === "string" ? handoff.status : undefined,
      findings: this.#inputFindings(),
      softCap:
        maxConsecutiveS1Rounds({ type: "branch", sourcePath: this.findingsPath }, nextRouter) >=
        SOFT_CAP_S1_ROUNDS,
    };
  }

  /** The branch-fix real-mode stdout capsule (`status: COMPLETED · blocker: <input count> ·
   *  handoff: <path>` + the derived `next:` line) — the CLI wrapper emits these on the parent
   *  stdout after run() returns. Re-reads the finalized handoff from disk (the engine-authoritative
   *  carrier normalizeResult wrote — post-exit-gate state). */
  get returnBlock(): string[] {
    const handoff = readJson(this.handoffPath) as {
      status?: string;
      findings?: Array<{ severity?: string }>;
      commits?: Record<string, unknown>;
    } | null;
    return resultFace.emit({
      op: "fix",
      handoffPath: this.handoffPath,
      status: handoff?.status,
      findings: this.#inputFindings(),
      next: this.#fixNextArgs(handoff),
    });
  }
}
