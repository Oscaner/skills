// packages/cdd-engine/src/artifacts/crash.ts — CrashTeardown (T7 crash recovery): the lane-agnostic
// crash teardown shared by the implement/review/fix/docs run wrappers — the engine's crash-recovery
// primitive, normalized from the deleted stash plane onto the commit ledger. When a dispatched child
// exits non-zero without writing its handoff, the teardown
//   ① captures the child stdout/stderr TAIL (~40 lines — the "harness 403 with no trace" mitigation)
//   ② crash-only snapshot (rules/commit.ts commitSnapshot — the tree normalizes into a commit)
//   ③ writes the crash record to Workspace.crashPath(lane, round) ({exitCode, stderrTail[],
//      stdoutTail[], snapshotSha, attemptedHandoff, next})
//   ④ returns the record so the lane emits the BLOCKED status capsule whose `next:` carries the
//      same-command resume.
// The crash record REPLACES the deleted handoff `recovery` carrier as the NextStepRouter recovery
// decision source (status BLOCKED + crash record present → next: <same command resume>) — the router
// reads the record's fields (snapshotSha + the resume command), never the carrier's recovery.
// Resume = re-dispatch the same command: the re-run starts from the snapshot commit (clean tree at
// the entry gate) and continues from the committed WIP — no redo, no residue loss.
import path from "node:path";
import type { Workspace } from "../infra/workspace.ts";
import { CommitChecker } from "../rules/commit.ts";

/** The capture window — how many trailing stdout/stderr lines the teardown preserves. */
export const CRASH_TAIL_LINES = 40;

/** The crash record — the crash-recovery artifact's on-disk shape (Workspace.crashPath(lane, round);
 *  written through the shared writeJson point, same family as lifecycle/handoff/base-branch). */
export interface CrashRecord {
  /** the dead child's exit code (1 = run failure, 143 = SIGTERM — the explicit exit-code semantics). */
  exitCode: number;
  /** last CRASH_TAIL_LINES lines of the child's stderr (the "403 / model abort without trace" tail). */
  stderrTail: string[];
  /** last CRASH_TAIL_LINES lines of the child's stdout. */
  stdoutTail: string[];
  /** the crash-only snapshot commit SHA (null when the tree was clean — nothing to snapshot — or a
   *  non-repo/git-error no-op). */
  snapshotSha: string | null;
  /** the handoff path the dead child was expected to write (null when the lane carries none). */
  attemptedHandoff: string | null;
  /** the same-command resume string — the NextStepRouter recovery row's decision source (emitted
   *  verbatim as `next: <resumeCommand>`). */
  next: string;
}

/** The lane facts the resume command reconstructs (mirror of the CLI dispatch surface: op/type/group/
 *  plan/doc/findings/range — each lane passes what its dispatch carried). */
export interface ResumeCommandArgs {
  op: string;
  type?: string;
  group?: string;
  plan?: string;
  doc?: string;
  findingsPath?: string;
  base?: string;
  head?: string;
}

/** resumeCommandFor — the DISPATCH's own command reconstructed for the re-run (the "same command"
 *  resume semantics): `cdd <op>[ --type <t>][ --tasks <g>][ --plan <p>][ --<type> <doc>]
 *  [ --findings <h>][ --base <b> --head <h>]`. review resumes without --findings (review derives its
 *  findings path internally) — the reconstruction mirrors the original invocation, not the next hop. */
export function resumeCommandFor(a: ResumeCommandArgs): string {
  const op = a.op;
  const type = a.type;
  const plan = a.plan ? ` --plan ${a.plan}` : "";
  const tasks = a.group ? ` --tasks ${a.group}` : "";
  const findings = a.findingsPath ? ` --findings ${a.findingsPath}` : "";
  // implement carries no --type (the task family is its only surface)
  if (op === "implement") return `cdd implement${tasks}${plan}`;
  if (type === "task") {
    return op === "review"
      ? `cdd review --type task${tasks}${plan}`
      : `cdd fix --type task${tasks}${plan}${findings}`;
  }
  if (type === "branch") {
    const range =
      op === "review"
        ? `${a.base ? ` --base ${a.base}` : ""}${a.head ? ` --head ${a.head}` : ""}`
        : findings;
    return `cdd ${op} --type branch${plan}${range}`;
  }
  if (type === "spec" || type === "plan") {
    const target = a.doc ? ` --${type} ${a.doc}` : "";
    return `cdd ${op} --type ${type}${target}${op === "fix" ? findings : ""}`;
  }
  // untyped/unknown fallback — the tasks/plan surface only
  return `cdd implement${tasks}${plan}`;
}

/** Tail capture — the trailing `n` lines of a raw stream (empty stream → []). A trailing newline
 *  (the natural stream suffix) does not produce a phantom empty entry. */
function tailLines(raw: string | undefined, n: number): string[] {
  const text = String(raw ?? "");
  if (!text) return [];
  const lines = text.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines.slice(-n);
}

/** CrashTeardown — the shared orphan-handling wrapper (Criterion ②; constructor injection — the
 *  CommitChecker seam defaulting to a fresh instance). run() performs steps ①–③ and returns the
 *  record; the calling lane emits the BLOCKED capsule (step ④) from its own dispatch facts. */
export class CrashTeardown {
  readonly #commit: CommitChecker;

  constructor(commit: CommitChecker = new CommitChecker()) {
    this.#commit = commit;
  }

  /** Run the crash teardown: ① tails ② crash-only snapshot ③ crash record write. Returns the record
   *  (the lane emits the capsule's `next:` from record.next via the NextStepRouter recovery input).
   *  Fail-open end to end: a snapshot failure does not block the record write (the record carries
   *  snapshotSha null), and the record write is machine-side (workspace writeJson) — never a throw
   *  across the caller's exit path. */
  async run(opts: {
    lane: string;
    round: number;
    exitCode: number;
    stdout: string;
    stderr: string;
    attemptedHandoff: string | null;
    next: string;
    workspace: Workspace;
    repoRoot: string | null;
  }): Promise<CrashRecord> {
    const snapshotSha = await this.#commit.commitSnapshot(opts.repoRoot, opts.lane, opts.exitCode);
    const record: CrashRecord = {
      exitCode: opts.exitCode,
      stderrTail: tailLines(opts.stderr, CRASH_TAIL_LINES),
      stdoutTail: tailLines(opts.stdout, CRASH_TAIL_LINES),
      snapshotSha,
      attemptedHandoff: opts.attemptedHandoff,
      next: opts.next,
    };
    const crashName = path.basename(opts.workspace.crashPath(opts.lane, opts.round));
    opts.workspace.writeJson(crashName, record);
    return record;
  }
}
