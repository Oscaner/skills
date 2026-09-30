// packages/cdd-engine/src/rules/next-step.ts — NextStepRouter (C5 `next:` output-face derivation,
// spec C5; T3). The router knowledge lives here as ONE class: every stdout result contract appends
// a machine-greppable `next:` line carrying the default next-hop suggestion, and the dispatch faces
// thread it through the ResultFace emit layer (rules/result-face.ts).
//
// C5-0 SUGGESTION SEMANTICS — the payload is the engine's DEFAULT next-hop suggestion for the
// current world state with no mid-stream change ("if you continue directly, this is the next
// step"), never a hard action. Overridable by every existing mechanism, all kept: I6 mid-backfill
// (user backfill lands after dispatch → world state changed → this suggestion is stale or moot,
// follow the current state), Plan Sole Writer / user adjudication (soft-cap intervention, terminal
// gate base/head, …), and the failure-mode table (a BLOCKED round goes the existing stderr
// `CDD_BLOCKED:` channel and produces NO `next:` line). Consumers quote it as "the engine's
// default next-hop suggestion; follow it when continuing directly".
//
// C5-1 SINGLE RESPONSIBILITY: the fix face is the ONLY decision point for re-review vs closure — the
// fix round holds the `--findings` full text, so the next hop derives from ITS severity
// (blockerCount): blockers present → re-review (next: review); warn/nit only → closure (next: none);
// consecutive-S1 soft cap → user adjudication. A review never previews what a fix will do (one-way:
// any findings → next: fix). The soft cap is REACHABLE in production — the fix faces (task
// #derivedNext / docs fix face / branch fix face) derive it from the ref-sequence walk
// (rules/ref-sequence.ts maxConsecutiveS1Rounds — which delegates the leading-run count to the
// shared pure consecutiveS1Count method here), compared against SOFT_CAP_S1_ROUNDS — never a
// caller-authored literal.
//
// C5-2 ZERO NEW CLI ARGUMENTS: this module reads only already-present dispatch ctx/opts fields
// (op/type/group/round/ref/status/findings/workspace/plan/commits.base-head) + the `--findings`
// content + the blocker count — parse.ts / usage / whitelist surfaces stay untouched.
//
// T3 (C5 command-contract plane): the Criterion ② class face — `nextStepFor` → `next(input)`
// instance method, `consecutiveS1Count` → instance method, the former module-level `convergence`
// singleton → constructor injection (ConvergenceChecker default). Zero bare function exports, zero
// module-level mutable state (the remaining module consts — SOFT_CAP_S1_ROUNDS / the decision-table
// literals — are immutable).
import { ConvergenceChecker } from "./convergence.ts";

/** The input the derivation draws on — a subset of the dispatch's existing ctx/opts fields (C5-2).
 *  Every field optional; the derivation degrades gracefully (missing facts → a shorter suggestion
 *  or the conservative `none`), never throws. */
export interface NextStepArgs {
  /** dispatch op: implement | review | fix. */
  op: "implement" | "review" | "fix";
  /** review/fix type: task | spec | plan | branch. */
  type?: string;
  /** the tasks group key (comma-joined TaskGroup.key()) — the task family's dispatch unit. */
  group?: string;
  /** the round number — unused by the decision table directly (the fix face's soft-cap basis reads
   *  it INDIRECTLY: the ref-sequence walk anchors at the source review's round R, rules/ref-sequence.ts). */
  round?: number;
  /** the round's concluding status (finalized): BLOCKED/TIMEOUT → no suggestion (null). */
  status?: string;
  /** findings — review: this round's findings; fix: the `--findings` INPUT content (C5-1). */
  findings?: ReadonlyArray<{ severity?: string }>;
  /** the findings handoff path — fix: the `--findings` input path; review: its own review handoff
   *  (the path the next fix round reads on `--findings`). */
  findingsPath?: string;
  /** plan path (--plan <p>) — task/branch families. */
  plan?: string;
  /** spec/plan doc path — the type-self-describing target arg (--spec of the docs family). */
  doc?: string;
  /** reviewed range base (branch family — the branch-review CLI requires --base/--head). */
  base?: string;
  /** reviewed range head. */
  head?: string;
  /** consecutive-S1 soft cap reached (fix) — the suggestion defers to user adjudication. Derived by
   *  the fix faces from the ref-sequence walk (maxConsecutiveS1Rounds >= SOFT_CAP_S1_ROUNDS); never
   *  a caller-authored literal. */
  softCap?: boolean;
  /** the next un-dispatched group key (task review, zero findings → remaining-group implement). */
  nextGroup?: string;
  /** all dispatch groups approved (task review, zero findings → terminal branch review). */
  allGroupsDone?: boolean;
  /** The crash-record-derived recovery facts (the crash record file is the
   *  decision source, NEVER the handoff `recovery` carrier — deleted with the stash plane): a
   *  BLOCKED round WITH a crash record present is deterministically recoverable → the router emits
   *  `next: <same command resume>` (resumeCommand verbatim); absent → the failure-mode no-`next:`
   *  face stands. */
  recovery?: { snapshotSha: string | null; resumeCommand: string } | null;
}

/** The failure lane — a BLOCKED/TIMEOUT round goes the stderr CDD_BLOCKED single channel (C5-1
 *  fix row + the C3/C4 carriers); it produces no `next:` line on any op. */
const FAILED_STATUS = new Set(["BLOCKED", "TIMEOUT"]);
/** The consecutive-S1 soft-cap suggestion — the user/Plan Sole Writer adjudicates (C5-0). */
const SOFT_CAP_SUGGESTION = "BLOCKED: review-cycle-cap — user adjudicates";
/** The clean terminal — no useful next hop within this dispatch's line. */
const NONE = "none";

/** C5-1 soft-cap threshold — the consecutive-S1 run length at which the fix face defers the next hop
 *  to user adjudication (the 'ref-sequence round counting' judgment basis). Soft by nature (C5-0): a
 *  default suggestion, never a hard stop — Plan Sole Writer / user adjudication override it. */
export const SOFT_CAP_S1_ROUNDS = 3;

/** NextStepRouter — the C5 decision table as one instance-method class (Criterion ②; constructor
 *  injection — the ConvergenceChecker backing the blocker-count judgment defaults to a fresh
 *  instance). */
export class NextStepRouter {
  readonly #convergence: ConvergenceChecker;

  constructor(convergence: ConvergenceChecker = new ConvergenceChecker()) {
    this.#convergence = convergence;
  }

  /** consecutiveS1Count(seq) — the C5-1 'ref-sequence round counting' pure judgment basis: how many
   *  entries from the START of seq (the review-round sequence, NEWEST round first — the ref sequence
   *  walked backward from the fix's source review) are S1 (>=1 blocker finding). The run stops at the
   *  first non-S1 entry; null/undefined/absent rounds end the run (unreadable history degrades the
   *  count to the conservative baseline, never a throw). Production caller: the fix faces' soft-cap
   *  derivation feeds the walked findings through rules/ref-sequence.ts
   *  (maxConsecutiveS1Rounds — which reads the round files and hands the newest-first sequence to
   *  this method), and the walk result is compared against SOFT_CAP_S1_ROUNDS. */
  consecutiveS1Count(
    seq: ReadonlyArray<ReadonlyArray<{ severity?: string }> | null | undefined>,
  ): number {
    let n = 0;
    for (const findings of seq) {
      if (findings && this.#convergence.blockerCount({ findings }) > 0) n += 1;
      else break;
    }
    return n;
  }

  // Shape helpers: only the present facts land on the line (missing args degrade the suggestion,
  // never a "undefined" literal). Suggestion semantics (C5-0): the orchestrator/user fills any
  // terminal-gate context the dispatch did not carry (e.g. a branch review base/head).
  #planArg(plan?: string): string {
    return plan ? ` --plan ${plan}` : "";
  }

  #tasksArg(group?: string): string {
    return group ? ` --tasks ${group}` : "";
  }

  /** The reviewed range tail (branch family): ` --base <b> --head <h>` — only the present segments land. */
  #rangeArg(range: { base?: string; head?: string }): string {
    let out = "";
    if (range.base) out += ` --base ${range.base}`;
    if (range.head) out += ` --head ${range.head}`;
    return out;
  }

  /** The type-self-describing target arg — type=spec → `--spec <doc>`, type=plan → `--plan <doc>`. */
  #targetArg(args: NextStepArgs): string {
    return args.type === "spec" ? (args.doc ? ` --spec ${args.doc}` : "") : this.#planArg(args.doc);
  }

  #findingsArg(path?: string): string {
    return path ? ` --findings ${path}` : "";
  }

  /** next(input) — the C5 derivation (C5-1 decision table): returns the `next:` line VALUE
   *  (callers prefix `next: `), or null when the round produces NO `next:` line — the BLOCKED /
   *  TIMEOUT failure-mode face (every op; the fix "itself BLOCKED produces no next:" row is the named case).
   *
   *  Table (the pure unit surface — rules/__tests__/next-step.test.ts pins every row):
   *    review  findings non-empty → cdd fix --type <t> [--tasks <n>] --plan <p> --findings <h>  (one-way)
   *    review  zero findings     → next: none | cdd implement --tasks <next> | cdd review --type branch …
   *    fix     input blocker>0   → cdd review --type <t> … (re-review, new ref)
   *    fix     input warn/nit    → next: none (closure-round naturalization — no re-review preview)
   *    fix     soft cap          → next: BLOCKED: review-cycle-cap — user adjudicates
   *    fix     itself BLOCKED    → no next: (failure-mode stderr face)
   *    BLOCKED + crash record    → next: <same command resume> (T7 crash recovery — the decision
   *                                source is the CRASH RECORD, never the handoff carrier; a recordless
   *                                BLOCKED round keeps the no-next: failure-mode face)
   */
  next(args: NextStepArgs): string | null {
    const { op, status, type } = args;
    // Crash-recovery row FIRST (before the failure-mode null): a BLOCKED round WITH a crash
    // record present is deterministically recoverable — the crash record (never the handoff
    // carrier — the `recovery` schema field is deleted with the stash plane) carries the same-command
    // resume, emitted verbatim. A recordless BLOCKED round keeps the failure-mode no-next: face.
    if (status === "BLOCKED" && args.recovery?.resumeCommand) return args.recovery.resumeCommand;
    if (status && FAILED_STATUS.has(status)) return null;

    if (op === "implement") {
      // Implement APPROVED → the group's review is the next hop.
      return `cdd review --type task${this.#tasksArg(args.group)}${this.#planArg(args.plan)}`;
    }

    if (op === "review") {
      const findings = args.findings ?? [];
      if (findings.length > 0) {
        // One-way: any findings (any severity) → the fix round (C5-1 — no preview of the fix's own outcome).
        if (type === "task") {
          return `cdd fix --type task${this.#tasksArg(args.group)}${this.#planArg(args.plan)}${this.#findingsArg(args.findingsPath)}`;
        }
        if (type === "branch") {
          return `cdd fix --type branch${this.#planArg(args.plan)}${this.#findingsArg(args.findingsPath)}`;
        }
        if (type === "spec" || type === "plan") {
          return `cdd fix --type ${type}${this.#targetArg(args)}${this.#findingsArg(args.findingsPath)}`;
        }
        return NONE;
      }
      // Zero findings (approved) → the group/plan flows on, or the terminal.
      if (type === "task") {
        if (args.allGroupsDone) {
          return `cdd review --type branch${this.#planArg(args.plan)}${this.#rangeArg(args)}`;
        }
        if (args.nextGroup) {
          return `cdd implement --tasks ${args.nextGroup}${this.#planArg(args.plan)}`;
        }
        return NONE;
      }
      return NONE;
    }

    if (op === "fix") {
      // C5-1: the fix round is the re-review / closure decision point (C5-2 — the blocker count
      // on the `--findings` INPUT content; the fix's own carrier never decides).
      if (args.softCap) return SOFT_CAP_SUGGESTION;
      if (this.#convergence.blockerCount({ findings: args.findings }) > 0) {
        if (type === "task") {
          return `cdd review --type task${this.#tasksArg(args.group)}${this.#planArg(args.plan)}`;
        }
        if (type === "branch") {
          return `cdd review --type branch${this.#planArg(args.plan)}${this.#rangeArg(args)}`;
        }
        if (type === "spec" || type === "plan") {
          return `cdd review --type ${type}${this.#targetArg(args)}`;
        }
        return NONE;
      }
      // No blockers in the input findings → closure-round naturalization: no re-review preview.
      return NONE;
    }

    return NONE;
  }
}
