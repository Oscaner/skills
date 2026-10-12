// packages/cdd-engine/src-next/face/cli.ts
// T11 — the command face + composition root (design spec §3.3: the cdd CLI command
// surface — implement / review / fix / schema / issue / base — is kept as a steady
// word face; T20 converges the base command face to `base` — the six-command surface
// unchanged in count). This module is the new tree's SOLE BARE ENTRY: the
// `cli` composition root (the module's one bare-function export, admitted by the
// plan's zero-bare-function discipline for composition roots) wires the contract /
// session / face objects into the ONE CLI the bin thin entry boots. Task 3 (P1)
// reorganized the face into one boundary per responsibility — the CLI declaration
// single surface (face/declare.ts, §2.4 — the six subcommand rows + the argv
// channel), the declaration projection (face/projection.ts — the CommandTreeBuilder
// whose commander program OWNS the parse + help + validation pipeline), and the run
// face; the typed argv parse channel (face/argv.ts) was deleted at T6 — the parse
// handover to commander is total, and the domain-run error face's usage is
// commander's own byte. This module keeps the RUN face: the dispatch seam
// (HarnessDispatch — the production default of the lifecycle's dispatch step), the
// work/pure command run bodies and the pre-flight orchestration (the renderers stay
// injected — the CLI orchestrates the call, never re-types their bytes).
//
//   · runArgv — parse through the commander program (face/projection.ts), dispatch
//     each parsed command through an .action thin shell (the parseArg-normalized
//     values ride into the domain run as its consumed values, zero rewriting) and
//     normalize the exit-code surface from the thrown CommanderError (0 = help/OK ·
//     2 = usage (incl. the preAction conditional-required) · 1 = run failure).
//   · the .action thin shells — the work commands (implement / review / fix)
//     assemble the lifecycle (session/run), the capsule + words (face), the ledger
//     (session/ledger) and the task graph (contract parse) and advance the
//     requested phase; schema / issue / base run their pure artifact surfaces
//     through the same assembled objects (the issue body is rendered by the
//     IssueBodyRenderer the root assembles — render/issue-body.ts, the P7
//     translation-system render landing).
//   · HarnessDispatch — the lifecycle's dispatch-seam production default: assembles
//     the dispatch prompt (the render/template-contract data plane) from the frame
//     and runs the host harness CLI (the harness-contract rows) with the child's
//     return block parsed back into the lifecycle's outcome. `--dry-run` substitutes
//     a synthetic approval so the round books without a child spawn.
//
// Module-level exports are types / constant data / classes / the cli composition
// root — zero behavior-carrying bare functions.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { type Command, CommanderError } from "commander";
import { declaredRegistries } from "../contract/declare.ts";
import { MarkdownPrimitives, PlanDocType } from "../contract/doc.ts";
import { Contract } from "../contract/judge.ts";
import type { DocKey } from "../contract/project.ts";
import { Projector } from "../contract/project.ts";
import { Translator } from "../contract/translate.ts";
import { ConfigLoader } from "../infra/config.ts";
import { GitClient } from "../infra/git.ts";
import type { HandoffFamily } from "../infra/runtime.ts";
import { Workspace, WorkspaceRoot } from "../infra/workspace.ts";
import { BriefRenderer } from "../render/brief.ts";
import { IssueBodyRenderer, type IssueReportInput } from "../render/issue-body.ts";
import { SkeletonAssembler } from "../render/skeleton.ts";
import type { TemplateValues, WorkMode } from "../render/templates.ts";
import { TemplateAssembler } from "../render/templates.ts";
import { BranchRef } from "../session/branch-ref.ts";
import type { DispatchPhase, TargetFace, TargetType } from "../session/faces.ts";
import { targetFaces } from "../session/faces.ts";
import { TaskGraph } from "../session/graph.ts";
import type { HandoffSchemaFace } from "../session/handoff-schema.ts";
import { HandoffSchema } from "../session/handoff-schema.ts";
import type { DocRevisionRef, HandoffParams, OpType, RoundStatus } from "../session/ledger.ts";
import { Ledger } from "../session/ledger.ts";
import type { Route } from "../session/next.ts";
import { NextStepRouter } from "../session/next.ts";
import type { PreFlightVerdict } from "../session/preflight.ts";
import { PreFlight } from "../session/preflight.ts";
import type { DispatchOutcome, DispatchStep, OpenFrame, RunState } from "../session/run.ts";
import { EMPTY_RUN_STATE, Lifecycle } from "../session/run.ts";
import { Capsule } from "./capsule.ts";
import { ARGV_CHANNEL, type CliLeafName, type CliVerb } from "./declare.ts";
import { GraphView } from "./graph-view.ts";
import {
  DISPATCH,
  HOSTS,
  type HostDetectSpec,
  type HostId,
  type HostReferenceTable,
  REFS,
} from "./host.ts";
import { CommandTreeBuilder } from "./projection.ts";
import { Words } from "./words.ts";

// ---------------------------------------------------------------------------
// the stable door — the face's public surface stays here (the declaration
// single surface lives in face/declare.ts; the guard audit reads the same rows
// straight from that surface, and the parse + usage-error face is the commander
// program's own product, face/projection.ts)
// ---------------------------------------------------------------------------

/** The CLI io seam — production wraps process stdio; tests capture. */
export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

// ---------------------------------------------------------------------------
// the pure artifact surfaces — the base artifact + the issue body
// ---------------------------------------------------------------------------

/** The base artifact schema — the sole CDD --plan target's read/write row (the
 *  artifact file carries the `base` face: the base branch the plan's line rides). */
export interface BaseArtifact {
  /** The base branch name. */
  base: string;
  /** The base's source channel (the engine-config source enum). */
  source: string;
  /** The plan path the artifact serves. */
  plan: string;
  /** The ISO write timestamp. */
  recordedAt: string;
}

// ---------------------------------------------------------------------------
// the sync process seam + the harness dispatch (the production dispatch default)
// ---------------------------------------------------------------------------

/** The sync child-process face — the fail-open subprocess seam the harness dispatch
 *  runs through (a non-zero/broken child rides the code, never a throw). */
export interface SyncProcess {
  run(
    command: string,
    args: readonly string[],
    cwd: string,
  ): { code: number; stdout: string; stderr: string };
}

/** SyncRunner — the node:child_process execFileSync adapter (sync because the T8
 *  lifecycle's DispatchStep seam is synchronous — one dispatch, one advance). */
export class SyncRunner implements SyncProcess {
  run(
    command: string,
    args: readonly string[],
    cwd: string,
  ): { code: number; stdout: string; stderr: string } {
    try {
      const stdout = execFileSync(command, [...args], { cwd, encoding: "utf8" });
      return { code: 0, stdout, stderr: "" };
    } catch (raw) {
      const error = raw as { status?: unknown; stdout?: unknown; stderr?: unknown };
      return {
        code: typeof error.status === "number" ? error.status : 1,
        stdout: typeof error.stdout === "string" ? error.stdout : "",
        stderr: typeof error.stderr === "string" ? error.stderr : "",
      };
    }
  }
}

/** The environment face the harness dispatch detects the host against. */
export type ProcessEnvLike = Record<string, string | undefined>;

/** One dispatch scene — the per-invocation composition the work commands assemble
 *  (the workspace + ledger the frame's round rides, the plan/brief paths the prompt
 *  references, the git HEAD the fix's re-review base derives). */
export interface DispatchScene {
  workspace: Workspace;
  ledger: Ledger;
  planPath: string | null;
  briefPath: string | null;
  head: string | null;
}

/**
 * HarnessDispatch — the lifecycle's dispatch-seam production default. `step()` returns
 * the DispatchStep the lifecycle runs, which assembles the dispatch prompt (the
 * render template-contract data plane) from the frame, runs the host harness CLI (the
 * harness-contract rows: cli + invoke flags + the phase's skill-ref slash form) and
 * parses the child's return block back into the lifecycle's outcome. Detection reads
 * the harness-contract detect markers from the injected env — empty host → a BLOCKED
 * outcome over the CDD_BLOCKED channel (never a thrown dispatch).
 */
export class HarnessDispatch {
  readonly #env: ProcessEnvLike;
  readonly #cwd: string;
  readonly #sync: SyncProcess;
  readonly #config: ConfigLoader;
  readonly #template: TemplateAssembler;
  readonly #io: CliIo;
  readonly #scene: DispatchScene;
  readonly #findings: string | null;
  /** The handoff-schema face — stateless, one shared instance (the read-back
   *  validator + the injected prompt text). */
  readonly #handoffSchema = new HandoffSchema();

  constructor(opts: {
    env?: ProcessEnvLike;
    cwd?: string;
    sync?: SyncProcess;
    config?: ConfigLoader;
    template?: TemplateAssembler;
    io?: CliIo;
    scene: DispatchScene;
    findings?: string | null;
  }) {
    this.#env = opts.env ?? process.env;
    this.#cwd = opts.cwd ?? process.cwd();
    this.#sync = opts.sync ?? new SyncRunner();
    this.#config = opts.config ?? new ConfigLoader();
    this.#template = opts.template ?? new TemplateAssembler();
    this.#io = opts.io ?? {
      stdout: (t) => process.stdout.write(t),
      stderr: (t) => process.stderr.write(t),
    };
    this.#scene = opts.scene;
    this.#findings = opts.findings ?? null;
  }

  /** The host-harness id detected from the env — "claude" | "cursor" | "pi" | "" —
   *  the first host detect row that matches (the detection priority: specific markers
   *  first, the generic AI_AGENT last). One row detects by its primary marker (a
   *  session env, presence/enum — a UUID CLAUDE_CODE_SESSION_ID is claude by presence)
   *  or by the AI_AGENT prefix (AI_AGENT=claude-code-…). */
  detectHost(env: ProcessEnvLike = this.#env): string {
    for (const id of ["claude", "cursor", "pi"] as const) {
      const detect: HostDetectSpec = HOSTS[id].detect;
      if (detect.env !== undefined && detect.env !== "") {
        const marker = env[detect.env];
        if (marker !== undefined && marker.length > 0) {
          if (detect.value !== undefined && marker !== detect.value) continue;
          return id;
        }
      }
      if (detect.aiAgentPrefix !== undefined && detect.aiAgentPrefix.length > 0) {
        const agent = env.AI_AGENT;
        if (agent !== undefined && agent.length > 0 && agent.startsWith(detect.aiAgentPrefix))
          return id;
      }
    }
    return "";
  }

  /** The DispatchStep the lifecycle runs — one frame → the outcome. */
  step(): DispatchStep {
    return (frame) => this.#dispatch(frame);
  }

  /** One dispatch — prompt from the template plane + the frame, host child via
   *  the harness-contract rows, the child's write-back read in (v1.9: the draft at
   *  OUTPUT_HANDOFF is the round's content — the three-line block is the pointer). */
  #dispatch(frame: OpenFrame): DispatchOutcome {
    const host = this.detectHost();
    if (host === "") {
      this.#io.stderr(
        "CDD_BLOCKED: no host harness detected (run cdd from within a supported harness)\n",
      );
      return { status: "BLOCKED" };
    }
    const prompt = this.#template.render(this.#valuesOf(frame));
    const row = HOSTS[host as HostId];
    const cliName = row.cli;
    const args = [...row.invoke.split(" ").filter((part) => part.length > 0)];
    const ref = this.#skillRef(host, frame);
    // The child receives ONE prompt argument — per the host's promptForm data column
    // (§3.5): the ref-prefixed form embeds the slash ref at the start of the single
    // prompt positional (claude -p consumes the whole first positional as the prompt;
    // a standalone ref arg after the flags would be swallowed, losing everything after
    // the ref) — the prompt assembly is data, never a code assumption.
    const result = this.#sync.run(
      cliName,
      [...args, this.#childPrompt(row.promptForm, ref, prompt)],
      this.#cwd,
    );
    if (result.code !== 0) {
      this.#io.stderr(`CDD_BLOCKED: child ${cliName} exited ${result.code}\n`);
      return { status: "BLOCKED" };
    }
    // The three-line block is the child's termination handshake — a child that exits 0
    // without a status line misbehaved (the abnormal face owns it; no draft read).
    if (!/^status:\s*\S+/m.test(result.stdout)) {
      this.#io.stderr(`CDD_BLOCKED: child ${cliName} returned no status line\n`);
      return { status: "BLOCKED" };
    }
    return this.#reconstruct(frame, this.#parseBlockReturn(result.stdout));
  }

  /** The work-mode of a frame phase — branch-review rides the review family. */
  #opOf(frame: OpenFrame): OpType {
    return frame.phase === "branch-review" ? "review" : frame.phase;
  }

  /** The dispatch-table work-mode (ROLE) of a frame — the spec/plan fix faces ride
   *  the docs-fix mode; everything else maps by its phase (§3.5's four-mode table). */
  #roleOf(frame: OpenFrame): WorkMode {
    if (frame.phase === "fix") {
      return frame.type === "spec" || frame.type === "plan" ? "docs-fix" : "fix";
    }
    return frame.phase === "implement" ? "implement" : "review";
  }

  /** The phase's skill-ref slash form for the detected host ("/mattpocock-skills:implement"
   *  · "/mattpocock-skills:code-review" etc.); null when the phase carries no skill
   *  ref (the fix face and the spec/plan reviews — their criteria ride the
   *  prompt's fixed body, never a slash arg). */
  #skillRef(host: string, frame: OpenFrame): string | null {
    const dispatch = DISPATCH;
    let ref: unknown = null;
    if (frame.phase === "review" || frame.phase === "branch-review") {
      // The task/branch rows are object-shaped {ref}; the spec/plan review types
      // carry NO dispatch row (their criteria are the review prompt's fixed body).
      const entry = dispatch.review[frame.type as "wave" | "branch"];
      const declaredRef = (entry as { ref?: unknown } | undefined)?.ref;
      ref =
        typeof declaredRef === "string" && declaredRef.startsWith("mattpocock-skills:")
          ? declaredRef
          : null;
    } else {
      // The implement row is the dispatch table's single string slot; the other
      // phases (fix) carry no dispatch row — the lookup resolves null (the fix
      // face's ref-less face, same-shape as the spec/plan reviews).
      const value = dispatch[frame.phase as "implement"];
      ref = typeof value === "string" ? value : null;
    }
    if (typeof ref !== "string") return null;
    const hostForm = (REFS as HostReferenceTable)[ref]?.[host as HostId];
    return hostForm ?? null;
  }

  /** The child's single prompt argument — per the host's promptForm data contract
   *  (§3.5): the ref-prefixed form embeds the skill-ref slash form at the start of
   *  the assembled dispatch prompt as one positional (`/kairos:cdd-* <prompt>`); the
   *  plain form passes the prompt verbatim. */
  #childPrompt(form: "ref-prefixed" | "plain", ref: string | null, prompt: string): string {
    return form === "ref-prefixed" && ref !== null ? `${ref} ${prompt}` : prompt;
  }

  /** The round-context zone values of the dispatch prompt (the v1.8 naming contract:
   *  ROLE nominative · WAVE (unit) · INPUT_* read-side · OUTPUT_* write-side · WORKSPACE_*
   *  environment · FIX_BASE anchor). Every declared token supplied — a mode's
   *  non-consumed slots stay empty and are NOT emitted by the assembler
   *  (empty-valued keys are dropped), so each mode's round context carries only the
   *  facts the mode reads. The review criteria/lens are NOT values — they fold into
   *  the review type's fixed prefix (§3.7). */
  #valuesOf(frame: OpenFrame): TemplateValues {
    const scene = this.#scene;
    const op = this.#opOf(frame);
    const role = this.#roleOf(frame);
    const params = frame.params;
    const isReview = frame.phase === "review" || frame.phase === "branch-review";
    const docPath = frame.target.kind === "doc" ? frame.target.doc : null;
    const isWave = frame.type === "wave";
    return {
      ROLE: role,
      // v1.22 (wave-unitary): the wave face's scope IS the wave (the whole task list)
      // — the round context speaks the UNIT, `WAVE`; the line faces carry their own
      // read-side identity (INPUT_RANGE/INPUT_DOC/INPUT_PLAN — the line faces' own
      // tokens under the wave-unitary model).
      WAVE: isWave ? (params.tasks ?? "") : "",
      INPUT_WAVE_BRIEF: this.#waveBrief(frame, scene, op),
      // find #4 (P4.1 T7): INPUT_RULES is RETIRED — the implement child reads the
      // plan's `## Constraints` section directly through INPUT_PLAN (zero materialized
      // plan-constraints file, zero dead pointer; the dispatcher-side rules channel is
      // gone — the constraint source is the plan document itself).
      // v1.9: INPUT_FINDINGS is fix/docs-fix only — the open findings of the source
      // review; a review writes its own draft (INPUT_FINDINGS === OUTPUT_HANDOFF
      // would be a short-circuit).
      INPUT_FINDINGS:
        op === "fix"
          ? (this.#findings ?? scene.ledger.handoffPath("review", frame.type, params))
          : "",
      INPUT_RANGE: isReview ? this.#reviewRange(frame) : "",
      INPUT_PLAN: scene.planPath ?? "",
      INPUT_DOC: docPath ?? "",
      // find #5 (P4.1 T7) — the prescribed artifact write paths (the {family}-{key}-
      // {artifact} single naming): the round context carries the canonical OUTPUT_*
      // names the child MUST use (zero free naming · cross-round zero overwrite); a
      // slot the frame's family does not consume stays empty and is dropped (only
      // present facts land).
      OUTPUT_BRIEF: this.#outputOf(frame, "brief"),
      OUTPUT_REPORT: this.#outputOf(frame, "report"),
      OUTPUT_EVIDENCE: this.#outputOf(frame, "evidence"),
      OUTPUT_HANDOFF: scene.ledger.handoffPath(op, frame.type, params),
      FIX_BASE: op === "fix" ? this.#fixedPoint(frame, params) : "",
      REVIEW_TYPE: isReview ? frame.type : "",
      WORKSPACE_DIR: scene.workspace.path,
      WORKSPACE_ID: scene.workspace.slug,
      // v1.9 — the injected writable-subset schema (projection ①): the `## Handoff
      // schema` section of the mode's fixed prefix (byte-stable per mode; the work
      // faces — implement/fix — carry the evidence-file fence too).
      HANDOFF_SCHEMA: this.#schemaText(frame),
    };
  }

  /** The canonical prescribed OUTPUT_* write path of one artifact kind (find #5 —
   *  the {family}-{key}-{artifact} single naming scheme; find #9 — branch line
   *  drops the range token: `branch-{op}{-round}-report.md` · `branch-test-evidence.json`,
   *  the carrier's `commits` holds the shas · doc = the {type}-{op}-{round} stem,
   *  spec-review-1). "" when the frame's family does not consume the slot — only
   *  present facts ride the prompt (the assembler drops the empty-valued keys). */
  #outputOf(frame: OpenFrame, kind: "brief" | "report" | "evidence"): string {
    const workspace = this.#scene.workspace;
    const op = this.#opOf(frame);
    if (frame.type === "spec" || frame.type === "plan") {
      // The doc family — the round-keyed {type}-{op}-{round} stem (spec-review-1):
      // every review/docs-fix round books its own report (a re-review never
      // overwrites its predecessor); brief/evidence are work-family faces only.
      if (kind !== "report") return "";
      return workspace.resolve(`${frame.type}-${op}-${frame.round}-report.md`);
    }
    if (kind === "brief") {
      // The implement round's brief — the engine-rendered input artifact (its canonical
      // tasks-{wave}-brief.md name; the line/work faces other than implement carry none).
      return frame.phase === "implement" ? (this.#scene.briefPath ?? "") : "";
    }
    const family = frame.type === "wave" ? `tasks-${frame.params.tasks ?? ""}` : "branch";
    if (kind === "report") {
      const suffix = frame.phase === "implement" ? "" : `-${frame.round}`;
      return workspace.resolve(`${family}-${op}${suffix}-report.md`);
    }
    // evidence — the work faces only (implement/fix write the canonical evidence file)
    if (frame.phase !== "implement" && frame.phase !== "fix") return "";
    return workspace.resolve(this.#evidenceName(frame));
  }

  /** The canonical evidence file name of a work frame (find #5/#9 — the
   *  {line}-test-evidence.json form: `tasks-{tasks}-test-evidence.json` /
   *  `branch-test-evidence.json` — the branch line's row-level current state,
   *  overwritten each round (the range token left the name);
   *  the same name the read-back gate reads). The line token joins when the frame
   *  keys it (the task face) — a key-less line (branch) names the family alone. */
  #evidenceName(frame: OpenFrame): string {
    const key = frame.type === "wave" ? (frame.params.tasks ?? "") : "";
    const line = key === "" ? this.#evidencePrefix(frame) : `${this.#evidencePrefix(frame)}-${key}`;
    return `${line}-test-evidence.json`;
  }

  /** The review's reference (INPUT_RANGE) — the fact the review criteria judge: the
   *  branch range (the short form — ⑦: unified with the wave face), the doc
   *  (spec/plan), or — task reviews — the reviewed commit range WAVE_BASE..HEAD
   *  derived from the implement round's handoff (§3.7 closeout: only present facts
   *  land — an unreadable implement handoff degrades to the plan path). */
  #reviewRange(frame: OpenFrame): string {
    // ⑦ — INPUT_RANGE renders the short range for branch and wave alike (one
    // decision in BranchRef; the child never needs the full shas to run git).
    if (frame.target.kind === "branch")
      return BranchRef.short(frame.target.base, frame.target.head);
    if (frame.target.kind === "doc") return frame.target.doc;
    const carried = this.#scene.ledger.readHandoff("implement", "wave", {
      tasks: frame.params.tasks ?? "",
    });
    const commits = carried?.commits as { base?: unknown; head?: unknown } | undefined;
    if (typeof commits?.base === "string" && typeof commits?.head === "string") {
      return BranchRef.short(commits.base, commits.head);
    }
    return this.#scene.planPath ?? "";
  }

  /** The round's task-brief input — the rendered brief (implement) or the prior
   *  implement round's brief file (task fixes — it exists on disk after the
   *  implement dispatch). "" outside the task work rounds; only present facts land. */
  #waveBrief(frame: OpenFrame, scene: DispatchScene, op: string): string {
    if (op === "implement") return scene.briefPath ?? "";
    if (op === "fix" && frame.type === "wave") {
      const brief = scene.workspace.resolve(`tasks-${frame.params.tasks}-brief.md`);
      return existsSync(brief) ? brief : "";
    }
    return "";
  }

  /** The fix round's fixed point — the source review's reviewed HEAD (the state the
   *  fix builds on — the shell's "the prior handoff's `commits.head`"; §3.7 closeout).
   *  Only present facts land: an unreadable source review yields the empty slot,
   *  never a guess; a review draft carrying only its reviewed base falls back to it. */
  #fixedPoint(frame: OpenFrame, params: OpenFrame["params"]): string {
    const carried = this.#scene.ledger.readHandoff("review", frame.type, params);
    const commits = carried?.commits as { base?: unknown; head?: unknown } | undefined;
    const anchor = typeof commits?.head === "string" ? commits.head : commits?.base;
    return typeof anchor === "string" ? anchor : "";
  }

  /** The RETURN_STDOUT_BLOCK child stdout → the outcome: the three canonical lines
   *  (status / commits / artifacts), each key=value tokens; a missing status line is
   *  a BLOCKED outcome (only present facts land). */
  #parseBlockReturn(stdout: string): DispatchOutcome {
    const status = stdout.match(/^status:\s*(\S+)/m)?.[1];
    if (status === undefined) return { status: "BLOCKED" };
    const outcome: DispatchOutcome = { status: status as RoundStatus };
    const commits = stdout.match(/^commits:\s*base=([0-9a-f]{8})(?:\s+head=([0-9a-f]{8}))?/m);
    if (commits !== null) outcome.commits = { base: commits[1], head: commits[2] ?? commits[1] };
    const artifacts = stdout.match(/^artifacts:(.*)$/m);
    if (artifacts !== null) {
      outcome.artifacts = {};
      for (const pair of artifacts[1].trim().split(/\s+/)) {
        const eq = pair.indexOf("=");
        if (eq !== -1) outcome.artifacts[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
    }
    return outcome;
  }

  // -------------------------------------------------------------------------
  // the read-back reconstruct (§3.6) — the draft is the round's content
  // -------------------------------------------------------------------------

  /** The read-back reconstruct — the child's draft at OUTPUT_HANDOFF is the round's
   *  content source of truth: read it, validate it against the mode's writable
   *  subset (projection ② of session/handoff-schema.ts — the SAME declared objects
   *  the prompt injected), then build the final carrier the lifecycle persists in
   *  place (agent draft → finalized, full-replace at the same path — the engine
   *  remains the carrier's single author). A missing or schema-violating draft →
   *  BLOCK over the CDD_BLOCKED channel + a crash record + the draft untouched
   *  (on failure, no overwrite — the child's work is never clobbered; resume re-runs the same
   *  command, which re-offers the round). The test-evidence file (task-family work
   *  rounds only) is read back with the same stakes: a missing/violating file
   *  rewrites the carrier to BLOCKED (persisted — the child's work is kept, marked
   *  bad), the second fix for a prose-only claim. */
  #reconstruct(frame: OpenFrame, block: DispatchOutcome): DispatchOutcome {
    const scene = this.#scene;
    const op = this.#opOf(frame);
    const face = this.#familyOf(op, frame.type).schema ?? "work";
    const schema = this.#handoffSchema;
    const path = scene.ledger.handoffPath(op, frame.type, frame.params);
    const draft = scene.ledger.readHandoff(op, frame.type, frame.params);
    if (draft === null) {
      return this.#reject(frame, path, `the handoff draft was not written at ${path}`);
    }
    const problems = schema.violations(face, draft);
    if (problems.length > 0) {
      return this.#reject(
        frame,
        path,
        `the handoff draft at ${path} violates the ${face} schema: ${problems.join("; ")}`,
      );
    }
    const findings = Array.isArray(draft.findings) ? draft.findings : [];
    let status: RoundStatus =
      face === "findings" ? schema.rollup(findings) : this.#workStatus(draft);
    let reason: string | null = null;
    // The evidence gate (v1.9) — the work faces (implement/fix task+branch) write
    // the canonical `{family-prefix}-{key}-test-evidence.json` under the workspace
    // (§3.7 naming: tasks- for the task families, branch- for the branch fix); the
    // docs faces (review/docs-fix) carry no evidence file. The read-back is REAL — a
    // missing/schema-violating file rewrites the draft to BLOCKED.
    if (face === "work") {
      const evidenceName = this.#evidenceName(frame);
      const evidencePath = scene.workspace.resolve(evidenceName);
      const evidence = scene.workspace.readJson<unknown>(evidenceName);
      const evidenceProblems = schema.evidenceViolations(evidence);
      if (evidenceProblems.length > 0) {
        status = "BLOCKED";
        reason = `the test evidence at ${evidencePath} violates the contract: ${evidenceProblems.join("; ")}`;
      }
    }
    return {
      status,
      findings: face === "findings" ? schema.findingsOf(draft.findings) : undefined,
      commits: block.commits,
      artifacts: block.artifacts,
      carrier: this.#materialize(frame, face, draft, status, reason),
    };
  }

  /** The read-back rejection face — CDD_BLOCKED reason + the crash record (the
   *  same-command resume's decision source: the attempted handoff + the resume
   *  command) + NO carrier (the bookkeep leaves the draft untouched). */
  #reject(frame: OpenFrame, path: string, reason: string): DispatchOutcome {
    this.#io.stderr(`CDD_BLOCKED: ${reason}\n`);
    const op = this.#opOf(frame);
    this.#scene.ledger.writeCrash(`${op}.${frame.type}`, frame.round, {
      exitCode: 0,
      stderrTail: [reason],
      stdoutTail: [],
      snapshotSha: null,
      attemptedHandoff: path,
      next: this.#resumeOf(frame),
      cause: "contract-violation",
    });
    return { status: "BLOCKED" };
  }

  /** Build the final carrier — the validated writable fields from the draft (the
   *  engine-seated identity rides the canonical file name, never inline: phase/tasks
   *  are not declared and never written — v1.30), persisted by the bookkeep
   *  full-replace at the SAME path (agent draft → finalized). The evidence override
   *  rewrites the status to BLOCKED + a failure_category + the reason note (the
   *  child's work preserved, marked bad). */
  #materialize(
    frame: OpenFrame,
    face: HandoffSchemaFace,
    draft: Record<string, unknown>,
    status: RoundStatus,
    reason: string | null,
  ): Record<string, unknown> {
    const ledger = this.#scene.ledger;
    const notes: string[] = [];
    const carrier = ledger.buildHandoff({
      artifacts: this.#canonicalArtifacts(frame, draft.artifacts, notes),
      findings: face === "findings" ? this.#findingsList(draft.findings) : [],
      commits: this.#commitsOf(draft.commits),
    });
    carrier.status = status;
    if (Array.isArray(draft.changes)) carrier.changes = draft.changes;
    if (typeof draft.failure_category === "string")
      carrier.failure_category = draft.failure_category;
    const draftNotes = Array.isArray(draft.notes) ? [...(draft.notes as unknown[])] : [];
    if (reason !== null) {
      carrier.status = "BLOCKED";
      carrier.failure_category = "evidence-contract";
      draftNotes.push(reason);
    }
    if (notes.length > 0 || draftNotes.length > 0) carrier.notes = [...notes, ...draftNotes];
    return carrier;
  }

  /** The carrier's artifacts map (find #5 — the engine self-derives, never trusts a
   *  child-reported path for the canonical slots): a declared PRESCRIBED slot
   *  (brief/report/test_evidence) books the frame's canonical OUTPUT_* path — a
   *  free-named deviation is replaced and surfaced on the notes (the review scope
   *  axis reads them); the non-prescribed slots (a docs-fix's `doc`, child extras)
   *  pass verbatim. undefined when the draft declared no artifacts. */
  #canonicalArtifacts(
    frame: OpenFrame,
    artifacts: unknown,
    notes: string[],
  ): Record<string, string> | undefined {
    const declared = this.#stringMap(artifacts);
    if (declared === undefined) return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(declared)) {
      const canonical = this.#prescribedArtifact(frame, key);
      if (canonical !== "" && value !== canonical) {
        notes.push(
          `artifact ${key}: declared path ${value} deviates from the prescribed ${canonical} — the canonical path is booked`,
        );
        out[key] = canonical;
      } else {
        out[key] = value;
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  /** The prescribed path of one block-artifact slot — a slot the frame's family
   *  prescribes (brief/report/test_evidence → the canonical OUTPUT_* name), "" for
   *  every other slot (a docs-fix's `doc` is never prescribed, it passes verbatim). */
  #prescribedArtifact(frame: OpenFrame, slot: string): string {
    switch (slot) {
      case "brief":
        return this.#outputOf(frame, "brief");
      case "report":
        return this.#outputOf(frame, "report");
      case "test_evidence":
        return this.#outputOf(frame, "evidence");
      default:
        return "";
    }
  }

  /** The work carrier's status — the child's declared conclusion (the schema's enum
   *  pinned it to APPROVED | BLOCKED; anything else degrades to BLOCKED — only present
   *  facts land, never an invented approval). */
  #workStatus(draft: Record<string, unknown>): RoundStatus {
    const status = draft.status;
    return status === "APPROVED" || status === "BLOCKED" ? status : "BLOCKED";
  }

  /** The `## Handoff schema` section value — the mode's writable-subset fence
   *  (projection ①; byte-fixed per mode so the prompt's fixed prefix stays
   *  cache-friendly). The family's `schema` field selects the face (§3.6: work →
   *  carrier + evidence fence for the implement/fix modes; findings → the review /
   *  docs-fix fence only). */
  #schemaText(frame: OpenFrame): string {
    const op = this.#opOf(frame);
    const face = this.#familyOf(op, frame.type).schema ?? "work";
    const evidence = face === "work";
    const prefix = evidence ? this.#evidencePrefix(frame) : "tasks";
    return this.#handoffSchema.schemaText(face, evidence, prefix);
  }

  /** The evidence file's family prefix (§3.7 naming) — the task-family work rounds
   *  use the canonical `tasks-` prefix; the branch fix uses the `branch-` family
   *  prefix (never the misleading tasks- spine). */
  #evidencePrefix(frame: OpenFrame): string {
    return frame.type === "wave" ? "tasks" : "branch";
  }

  /** The op.type family record — the engine-config handoff namespace single truth
   *  (loud on an unknown family: never a second naming table). */
  #familyOf(op: string, type: string): HandoffFamily {
    const family = this.#config.engineConfig().handoffNamespace.families[`${op}.${type}`] as
      | HandoffFamily
      | undefined;
    if (family === undefined) throw new Error(`unknown handoff family: ${op}.${type}`);
    return family;
  }

  /** The artifacts field as a string-map (only string values land — non-string rows
   *  are dropped, never coerced). */
  #stringMap(artifacts: unknown): Record<string, string> | undefined {
    if (typeof artifacts !== "object" || artifacts === null || Array.isArray(artifacts))
      return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(artifacts)) {
      if (typeof value === "string") out[key] = value;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  /** The commits field as the {base, head?} shape — only present facts land. */
  #commitsOf(commits: unknown): { base: string; head?: string } | undefined {
    if (typeof commits !== "object" || commits === null) return undefined;
    const row = commits as { base?: unknown; head?: unknown };
    if (typeof row.base !== "string") return undefined;
    return { base: row.base, head: typeof row.head === "string" ? row.head : undefined };
  }

  /** The draft findings as a plain list (the materialized carrier keeps them
   *  verbatim; the schema validated their shape before this ran). */
  #findingsList(findings: unknown): unknown[] {
    return Array.isArray(findings) ? findings : [];
  }

  /** The same-command resume string — the crash record's `next`, mirroring the
   *  CLI's dispatchable form of this frame (re-run the same command per the BLOCKED
   *  `next:` to continue — the idempotent full mode re-run). */
  #resumeOf(frame: OpenFrame): string {
    const scene = this.#scene;
    const plan = scene.planPath ?? "<plan>";
    switch (frame.phase) {
      case "implement":
        return `cdd implement --tasks ${frame.params.tasks ?? ""} --plan ${plan}`;
      case "branch-review": {
        const range = frame.target as { kind: "branch"; base: string; head: string };
        // find #10 — the review face consumes the 8-char short flags (full-shas
        // retired engine-wide); the workspace-identity `--plan` rides (find #8
        // F1b · spec §5.7 fix ② — a plan-less `#sceneOf` resolves to the empty
        // ref.short() directory).
        const ref = new BranchRef(range.base, range.head);
        return `cdd review --type branch --plan ${plan} ${ref.args()}`;
      }
      case "review":
        if (frame.type === "spec") return `cdd review --type spec --spec ${this.#docOf(frame)}`;
        if (frame.type === "plan") return `cdd review --type plan --plan ${this.#docOf(frame)}`;
        return `cdd review --type wave --tasks ${frame.params.tasks ?? ""} --plan ${plan}`;
      case "fix": {
        const findings = scene.ledger.handoffPath("review", frame.type, frame.params);
        const target =
          frame.target.kind === "doc"
            ? `--${frame.type === "spec" ? "spec" : "plan"} ${frame.target.doc}`
            : // branch fix carries no refs — the range rides the --findings handoff;
              // the workspace-identity `--plan` still rides (find #8 F1b · spec §5.7
              // fix ② — a plan-less `#sceneOf` resolves to the empty ref.short()
              // directory, with zero orchestrator fallback)
              frame.target.kind === "branch"
              ? `--plan ${plan}`
              : `--tasks ${frame.params.tasks ?? ""} --plan ${plan}`;
        return `cdd fix --type ${frame.type} ${target} --findings ${findings}`;
      }
    }
  }

  /** The doc path of a doc-target frame (the `""` never lands — the reject paths
   *  only frame docs). */
  #docOf(frame: OpenFrame): string {
    return frame.target.kind === "doc" ? frame.target.doc : "";
  }
}

// ---------------------------------------------------------------------------
// the Cli — the parse/run command face
// ---------------------------------------------------------------------------

/** The composition options — every collaborator injectable (tests substitute the
 *  hermetic ones: io / dispatch / repoRoot / stdin); the production defaults wire
 *  the living process. */
export interface CliOptions {
  io?: CliIo;
  config?: ConfigLoader;
  projector?: Projector;
  words?: Words;
  translator?: Translator;
  git?: GitClient;
  sync?: SyncProcess;
  cwd?: string;
  repoRoot?: string;
  dryRun?: boolean;
  dispatch?: DispatchStep | null;
  preflight?: PreFlight;
  template?: TemplateAssembler;
  brief?: BriefRenderer;
  stdinRead?: () => string;
}

/** One work command's assembled scene — the composition the run body advances. */
export interface WorkScene extends DispatchScene {
  planText: string | null;
  type: TargetType;
  face: TargetFace;
  target: { kind: "branch"; base: string; head: string } | { kind: "doc"; doc: string } | null;
  state: RunState;
  router: NextStepRouter;
}

/** The thin-shell → run-body input — the .action shell maps commander's parsed
 *  opts onto this consumption face (the parseArg-normalized values ride through
 *  verbatim, zero rewriting: int-list → the comma string · enum → the value · sha
 *  → the short form · the schema <type> → the parseTypeKey normalization). The
 *  CLI's parse-result face retired with the argv channel at T6 — commander owns
 *  the parse; this seam is the run face's own shape, never a parallel parse
 *  product. */
export interface RunInput {
  /** The nested leaf word (schema get|gen · base set|get) — null on the verbs. */
  leaf: CliLeafName | null;
  /** The declared keys' values — normalized strings (undefined-flagged keys absent). */
  args: Record<string, string>;
  /** The positional values (the schema <type> — the parseTypeKey-normalized key). */
  positionals: readonly string[];
  /** The invocation's synthetic-dispatch scope (the --dry-run program flag). */
  dryRun: boolean;
}

/**
 * The Cli — the command face's parse/run surface over the assembled object graph.
 * runArgv() parses through the commander program and rejects unknown flags (the
 * unknown-flag semantics); run() dispatches to the command's run body — the work verbs
 * compose the lifecycle/capsule/ledger/graph and advance the requested phase, the
 * pure verbs run their artifact surfaces through the same assembled objects.
 */
export class Cli {
  readonly #io: CliIo;
  readonly #config: ConfigLoader;
  readonly #projector: Projector;
  readonly #words: Words;
  readonly #git: GitClient;
  readonly #sync: SyncProcess;
  readonly #cwd: string;
  readonly #repoRoot: string | null;
  readonly #dryRun: boolean;
  readonly #dispatch: DispatchStep | null;
  readonly #template: TemplateAssembler;
  readonly #brief: BriefRenderer;
  readonly #stdinRead: () => string;
  readonly #issue: IssueBodyRenderer;
  readonly #translator: Translator;
  /** The plan-graph display (the schema get plan-graph + the pre-flight face). */
  readonly #graphView: GraphView;
  /** The lifecycle pre-flight seam (P4.1 T1) — the single dispatch gate the work
   *  commands consult before ANY child dispatch (tree-clean → plan-graph → wave →
   *  doc-contract; the CLI orchestrates the call + the render, never a re-type). */
  readonly #preflight: PreFlight;
  /** The contract coordinator — the shared doc-key derivation face (deriveDocType)
   *  the pre-flight doc construction reads (design spec §2.3: the derivation point
   *  converges to the single contract method). */
  readonly #contract: Contract;
  /** The commander command tree — the declaration projection (CommandTreeBuilder,
   *  face/projection.ts): the domain-run error face's usage byte is the command
   *  node's commander-native helpInformation() first line (the self-built usage
   *  corpus is retired; the T3 rebuild closes the parse face onto the same
   *  program). */
  readonly #program: Command;

  constructor(opts: CliOptions = {}) {
    this.#io = opts.io ?? {
      stdout: (t) => process.stdout.write(t),
      stderr: (t) => process.stderr.write(t),
    };
    this.#config = opts.config ?? new ConfigLoader();
    this.#words = opts.words ?? new Words();
    this.#projector = opts.projector ?? new Projector(declaredRegistries);
    this.#program = new CommandTreeBuilder().program;
    this.#wireTreeOutput(this.#program);
    this.#wireActions();
    this.#git = opts.git ?? new GitClient();
    this.#sync = opts.sync ?? new SyncRunner();
    this.#cwd = opts.cwd ?? process.cwd();
    this.#repoRoot = opts.repoRoot ?? null;
    this.#dryRun = opts.dryRun ?? false;
    this.#dispatch = opts.dispatch ?? null;
    this.#template = opts.template ?? new TemplateAssembler();
    this.#brief = opts.brief ?? new BriefRenderer();
    this.#stdinRead = opts.stdinRead ?? (() => readFileSync(0, "utf8"));
    this.#translator = opts.translator ?? new Translator(this.#words);
    this.#issue = new IssueBodyRenderer(this.#words, this.#translator);
    this.#graphView = new GraphView();
    this.#contract = new Contract();
    this.#preflight =
      opts.preflight ??
      new PreFlight({
        git: this.#git,
        contract: this.#contract,
        words: this.#words,
      });
  }

  // ---------------------------------------------------------------------------
  // the commander parse pipeline — the composition root parses through the
  // projection's program (T3): the .action thin shells (below) dispatch the parsed
  // command to its domain run; the exit-code discriminator maps the CommanderError
  // surface (§3.1 — probe-verified v0.9): help exit 0 / helpDisplayed → 0 · help
  // non-zero (bare run · missing subcommand · help <bogus>) + usage-class codes →
  // 2 · an unexpected throw → 1.
  // ---------------------------------------------------------------------------

  /** runArgv(argv) — the CLI face: parse through the commander program, return the
   *  thin shell's domain-run exit code (0 = success/help · 2 = usage · 1 = run
   *  failure — the steady exit-code table). Every commander/normal usage error
   *  discriminates on the thrown CommanderError: the help display faces write
   *  themselves through the node's configured output (the CLI never re-types a
   *  help byte), the parse/usage rejections carry commander's own "error: " line
   *  (never double-written), and the preAction conditional-required rejection (the
   *  one commander throws unwritten) is surfaced by the run face. */
  async runArgv(raw: readonly string[]): Promise<number> {
    try {
      this.#exitCode = 0;
      await this.#program.parseAsync([...raw], { from: "user" });
      return this.#exitCode;
    } catch (err) {
      return this.#normalizeExit(err);
    }
  }

  /** The exit-code discriminator — the CommanderError surface (§3.1): the explicit
   *  help faces exit 0, the missing-command/missing-subcommand faces ride the help
   *  code's non-zero exit → 2, the usage-class codes (unknown option/command ·
   *  invalid argument (incl. the preAction conditional-required) · excess args ·
   *  missing required) → 2, an unexpected error → 1. */
  #normalizeExit(err: unknown): number {
    if (err instanceof CommanderError) {
      if (err.code === "commander.help") return err.exitCode === 0 ? 0 : 2;
      if (err.code === "commander.helpDisplayed") return 0;
      // usage-class — commander's own error() already wrote its "error: ..." line
      // (the parseArg/unknown surfaces); the preAction hook's InvalidArgumentError
      // and the run bodies' #usage throw are both thrown unwritten — the run face
      // surfaces them once.
      if (!err.message.startsWith("error: ")) this.#io.stderr(`error: ${err.message}\n`);
      return 2;
    }
    this.#io.stderr(`cdd: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }

  /** The domain-run usage error — a usage rejection raised inside a run body:
   *  commander's OWN CommanderError (never a second error type — the retired
   *  parse-channel error class is deleted at T6), which the normalizeExit
   *  discriminator above surfaces with the native "error:" byte and exit 2 (§3.1).
   *  The usage byte is the owning command node's commander-native
   *  helpInformation() first line (the declaration's help face — the self-built
   *  usage corpus never returned here); the throw carries only the message. */
  #usage(node: Command, message: string): never {
    const usageLine = node.helpInformation().split("\n")[0];
    if (usageLine !== "") this.#io.stderr(`${usageLine}\n`);
    throw new CommanderError(2, "cdd.usage-error", message);
  }

  /** The per-invocation exit code the thin shells capture (commander discards the
   *  action's return — parseAsync resolves with the program node, so the shell
   *  writes the domain-run's code here and runArgv reads it back). */
  #exitCode = 0;

  /** The .action thin shells — the parsed command → its domain run: build the
   *  run input from commander's parsed opts (parseArg-normalized values pass
   *  through as the domain's consumed values — no rewrite, §3.3) and dispatch to
   *  the domain run, capturing the exit code. */
  #wireActions(): void {
    const commandNode = (name: CliVerb) => this.#program.commands.find((c) => c.name() === name)!;
    const leafNode = (parent: CliVerb, name: CliLeafName) =>
      commandNode(parent).commands.find((c) => c.name() === name)!;

    // the work verbs — implement / review / fix compose the domain run
    for (const verb of ["implement", "review", "fix"] as const) {
      commandNode(verb).action(async (_opts: unknown, command: Command) => {
        this.#exitCode = await this.#runWork(verb, command, this.#runInput(null, command));
      });
    }
    // the pure commands' leaves — schema get/gen · base set/get · issue render
    leafNode("schema", "get").action(async (_type: unknown, _opts: unknown, command: Command) => {
      this.#exitCode = await this.#runSchema(command, this.#runInput("get", command));
    });
    leafNode("schema", "gen").action(async (_type: unknown, _opts: unknown, command: Command) => {
      this.#exitCode = await this.#runSchema(command, this.#runInput("gen", command));
    });
    leafNode("base", "set").action(async (_opts: unknown, command: Command) => {
      this.#exitCode = await this.#runBase(command, this.#runInput("set", command));
    });
    leafNode("base", "get").action(async (_opts: unknown, command: Command) => {
      this.#exitCode = await this.#runBase(command, this.#runInput("get", command));
    });
    leafNode("issue", "render").action(async () => {
      this.#exitCode = this.#runIssue();
    });
  }

  /** The thin shell's run input — commander's parsed opts mapped to the domain
   *  run's consumption face (the parseArg-normalized values ride through verbatim:
   *  int-list → the comma string · enum → the value · sha → the short form · the
   *  schema <type> → the parseTypeKey normalization), plus the positionals
   *  (processedArgs) and the program-scope dry-run (optsWithGlobals — the flag
   *  lives on the program node, merged here). The args read GLOBALS too: a flag
   *  declared on the parent command (schema's --plan) is consumed by that node —
   *  the leaf's own opts would miss it. */
  #runInput(leaf: CliLeafName | null, command: Command): RunInput {
    const globals = command.optsWithGlobals() as Record<string, unknown>;
    const args: Record<string, string> = {};
    for (const [key, value] of Object.entries(globals)) {
      if (value === undefined) continue;
      args[key] = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
    }
    return {
      leaf,
      args,
      positionals: command.processedArgs as string[],
      dryRun: this.#dryRun || globals.dryRun === true,
    };
  }

  /** Configure every node's output into the injected io (commander writes its
   *  help/error bytes through the node that produced them — a subcommand's help
   *  uses the subcommand's own output configuration, so the whole tree must be
   *  wired, never just the program). */
  #wireTreeOutput(node: Command): void {
    node.configureOutput({
      writeOut: (text) => this.#io.stdout(text),
      writeErr: (text) => this.#io.stderr(text),
    });
    for (const child of node.commands) this.#wireTreeOutput(child);
  }

  // ---------------------------------------------------------------------------
  // the work commands — lifecycle/capsule/ledger composition + the phase advance
  // ---------------------------------------------------------------------------

  /** One work command's run — assemble the scene, advance the requested phase (the
   *  lifecycle's single dispatch step per frame), render the capsule lines. */
  async #runWork(verb: CliVerb, node: Command, parsed: RunInput): Promise<number> {
    const type = (parsed.args.type ?? "wave") as TargetType;
    if (type === "wave" && parsed.args.tasks === undefined) {
      this.#usage(node, `cdd ${verb} --type wave: missing required --tasks <n|n,n,…>`);
    }
    const scene = await this.#sceneOf(verb, type, node, parsed);

    // THE pre-flight seam (P4.1 T1 · design §1): the single dispatch gate —
    // tree-clean → plan-graph → wave → doc-contract — ONE call, the whole sequence
    // lives in the seam (session/preflight.ts), the CLI only orchestrates the call
    // + the verdict render (zero re-implemented gate here). A refused verdict
    // returns before any brief/lifecycle: no child dispatch ever runs. The
    // dirty-tree / doc-contract refusals ride the CDD_BLOCKED channel; the
    // plan-graph / wave refusals keep the pre-existing refusal face.
    const docPath = scene.target !== null && scene.target.kind === "doc" ? scene.target.doc : "";
    const preflight = await this.#preflight.vet({
      verb: verb as "implement" | "review" | "fix",
      type,
      repoRoot: scene.workspace.root.repoRoot,
      planText: scene.planText,
      tasks: type === "wave" ? new Set(this.#tasksOf(parsed)) : null,
      ledger: scene.ledger,
      doc:
        type === "spec" || type === "plan"
          ? {
              docKey: type === "plan" ? "plan" : this.#contract.deriveDocType(docPath),
              path: docPath,
            }
          : null,
    });
    if (!preflight.ok) {
      this.#renderPreflightBlocked(verb, preflight, scene);
      return 1;
    }

    if (verb === "implement" && scene.planText !== null)
      scene.briefPath = this.#renderBrief(scene, parsed);
    const expected =
      verb === "implement" ? "implement" : verb === "fix" ? "fix" : scene.face.product.reviewLead;

    // The per-invocation batch cursor: the in-memory done set mirrors the on-disk
    // ledger's closed waves (the C5 closure single face) — NOT a "every non-group
    // task pre-done" shortcut. The old shortcut made the frontier yield exactly the
    // requested group, but it also emptied readyBatch() at every closure: a mid-run
    // wave's fix rendered `next: done` instead of the next wave (the {16,22,24} →
    // {25,26,27} bug — the closure routing judged a per-invocation cursor, not the
    // plan's real remaining frontier). The ledger mirror keeps the progress face
    // cross-invocation: the dispatched group's own closure marks in #markTerminal
    // as the loop advances, and the next wave surfaces from the live closed set.
    let group: Set<number> | null = null;
    if (type === "wave") {
      group = new Set(this.#tasksOf(parsed));
      const planIds =
        scene.planText !== null
          ? new PlanDocType("plan")
              .parse(scene.planText.split("\n"))
              .taskBlocks.map((block) => block.id)
          : [];
      for (const id of group) {
        if (!planIds.includes(id)) {
          this.#usage(node, `cdd ${verb}: task ${id} not found in the plan`);
        }
      }
      for (const id of scene.ledger.closedWaves()) scene.state.markDone(id);
    }

    const statuses: (RoundStatus | null)[] = [];
    const dispatch: DispatchStep = this.#dispatchOf(scene, parsed);
    const run = new Lifecycle({
      face: scene.face,
      state: scene.state,
      ledger: scene.ledger,
      router: scene.router,
      // The dispatch-entry pre-flight wiring (P4.1 T1): the single seam verdict the
      // work command computed rides the lifecycle's gate — a refused frame is
      // structurally never passed to the child (the lifecycle's hard "child zero-dispatch"
      // guarantee; the CLI already returned above when the seam refused).
      preflight: { gate: () => (preflight.ok ? null : preflight) },
      dispatch: (frame) => {
        const outcome = dispatch(frame);
        statuses.push(outcome.status ?? null);
        if (
          scene.briefPath !== null &&
          outcome.artifacts !== undefined &&
          outcome.artifacts.brief === undefined
        ) {
          outcome.artifacts.brief = scene.briefPath;
        }
        return outcome;
      },
      target: scene.target ?? undefined,
      capsule: new Capsule(this.#words, ARGV_CHANNEL),
      planPath: scene.planPath,
    });

    // The requested-phase gate — the line faces (branch/spec/plan) keep the
    // line-phase readiness check; the task face needs no second gate (the WaveGate's
    // wrong-phase verdict above IS the phase authority for the requested wave).
    if (group === null) {
      const { phase: open, verdict, reviewed } = this.#lineGate(scene);
      if (open !== expected) {
        const pendingBlock =
          verdict === "pending-fix" ? this.#pendingFixBlock(scene, reviewed) : null;
        const docBlock = open === null ? this.#docLineBlock(scene, reviewed) : null;
        this.#io.stderr(
          `cdd ${verb}: cannot dispatch a ${expected} round — ${pendingBlock ?? docBlock ?? (open === null ? "the line holds no open round" : `the next round is ${open}${this.#phaseHint(open)}`)}\n`,
        );
        return 1;
      }
    }

    // Advance the requested phase across the wave (one dispatch per frame — the
    // lifecycle's "one dispatch, one advance" step), keeping only the LAST step's
    // capsule for the invocation's single stdout face (the per-step intermediate
    // next-wave lines stay in the router, never on the CLI face). The loop PEEKS
    // before every advance: advance() dispatches on entry, so an expected-phase
    // mismatch must be judged against the next frame BEFORE it spends the round —
    // the {16,22,24} bug's lookahead-after-dispatch consumed the next wave's round
    // in the same invocation (implement 1 silently closed wave 1's review round).
    let dispatched = 0;
    let latest: readonly string[] = [];
    let lastStatus: RoundStatus | null = null;
    for (;;) {
      const frame = run.peekNext();
      if (frame === null) break;
      const waveTasks = frame.target.kind === "wave" ? frame.target.tasks : null;
      const mismatch =
        frame.phase !== expected ||
        (group !== null && (waveTasks === null || !waveTasks.every((id) => group!.has(id))));
      if (mismatch) {
        if (dispatched === 0) {
          this.#io.stderr(
            `cdd ${verb}: cannot dispatch a ${expected} round — the next round is ${frame.phase}${waveTasks !== null ? ` for wave ${waveTasks.join(",")}` : ""}${this.#phaseHint(frame.phase)}\n`,
          );
          return 1;
        }
        break;
      }
      const step = run.advance();
      if (step === null) break;
      // The dispatch-entry gate's refusal (the lifecycle's hard child zero-dispatch wiring —
      // structurally unreachable here: the seam already returned above on refusal).
      if (step.preflight !== undefined) {
        this.#renderPreflightBlocked(verb, step.preflight, scene);
        return 1;
      }
      dispatched += 1;
      latest = step.capsuleLines;
      lastStatus = statuses[statuses.length - 1] ?? null;
      // NO manual done-marking here: the lifecycle's markTerminal is the single
      // closure gate (C5) — a dispatched wave advances the frontier only through
      // its concluded round's route. The old dispatch-then-markDone shortcut drove
      // the loop across waves without a closure verdict: after implement of wave 1
      // it marked wave 1 done, so the loop dispatched wave 2 in the same call
      // (dry-run) and rendered every mid-run closure as `next: done` (the per-step
      // next was already consumed). The ledger-mirrored cursor above + markTerminal
      // together keep one wave phase per invocation.
      if (lastStatus === "BLOCKED" || lastStatus === "TIMEOUT") {
        for (const line of latest) this.#io.stdout(`${line}\n`);
        return 1;
      }
      // The no-next hard error (v1.20): a completed non-failed round must produce a
      // `next:` line — null after a passed BLOCKED/TIMEOUT check is an abnormal
      // completion, never a silent approved-without-next.
      if (step.route === null) {
        for (const line of latest) this.#io.stdout(`${line}\n`);
        this.#io.stderr(
          `${this.#words.station("blocked")} the round concluded ${lastStatus ?? "APPROVED"} with no next: line — a completed non-failed round must yield a next-hop route (re-run the same command to continue)\n`,
        );
        return 1;
      }
    }
    if (dispatched === 0) {
      this.#io.stderr(`cdd ${verb}: nothing to dispatch — the line holds no open frame\n`);
      return 1;
    }
    for (const line of latest) this.#io.stdout(`${line}\n`);
    return 0;
  }

  /** The dispatch seam — the injected override, else the dry-run synthetic approval,
   *  else the harness production default. */
  #dispatchOf(scene: WorkScene, parsed: RunInput): DispatchStep {
    if (this.#dispatch !== null) return this.#dispatch;
    if (parsed.dryRun || this.#dryRun) {
      const head = scene.head;
      return (frame) => {
        const isWork = frame.phase === "implement" || frame.phase === "fix";
        if (!isWork) return { status: "APPROVED", findings: [] };
        return head === null
          ? { status: "APPROVED" }
          : { status: "APPROVED", commits: { base: head, head } };
      };
    }
    const harness = new HarnessDispatch({
      env: process.env,
      cwd: this.#cwd,
      sync: this.#sync,
      config: this.#config,
      template: this.#template,
      io: this.#io,
      scene: {
        workspace: scene.workspace,
        ledger: scene.ledger,
        planPath: scene.planPath,
        briefPath: scene.briefPath,
        head: scene.head,
      },
      findings: parsed.args.findings ?? null,
    });
    return harness.step();
  }

  /** The phase-mismatch hint — what to run instead. */
  #phaseHint(phase: string): string {
    switch (phase) {
      case "implement":
        return " — run cdd implement first";
      case "review":
      case "branch-review":
        return " — run cdd review first";
      default:
        return " — run cdd fix first";
    }
  }

  /** Render a refused pre-flight verdict — the work command's BLOCK face (P4.1 T1).
   *  The dirty-tree / doc-contract refusals ride the CDD_BLOCKED channel (the
   *  commit/discard guidance + the named structural findings); the plan-graph / wave
   *  refusals keep the pre-existing refusal face (the wave-board hint renders for the
   *  wave gate's split row — its done face rides the SAME closedWaves() read the gate
   *  judged, one closed set, one source). */
  #renderPreflightBlocked(verb: CliVerb, verdict: PreFlightVerdict, scene: WorkScene): void {
    if (verdict.gate === "tree-clean" || verdict.gate === "doc-contract") {
      this.#io.stderr(`${this.#words.station("blocked")} ${verdict.message ?? ""}\n`);
      for (const detail of verdict.details ?? []) this.#io.stderr(`  ${detail}\n`);
      return;
    }
    this.#io.stderr(`cdd ${verb}: ${verdict.message ?? "the dispatch gate refused the request"}\n`);
    for (const detail of verdict.details ?? []) this.#io.stderr(`  ${detail}\n`);
    if (verdict.gate === "wave" && verdict.reason === "split" && scene.planText !== null) {
      const graph = new TaskGraph(new PlanDocType("plan").parse(scene.planText.split("\n")));
      const closed = scene.ledger.closedWaves();
      for (const line of this.#graphView
        .render(graph.report(closed), `plan-graph: ${scene.planPath ?? ""}`)
        .split("\n"))
        this.#io.stderr(`  ${line}\n`);
    }
  }

  // ---------------------------------------------------------------------------
  // the requested-phase gate — the work commands' readiness check
  // ---------------------------------------------------------------------------

  /** The single-target line's current open phase plus the doc-line verdict the gate
   *  judged — the {phase, verdict} pair IS the gate's ruling: the revision-aware
   *  BLOCK renders only the "same" verdict the gate returned, the pending-fix note
   *  only the derived pending face, never a recomputed one. The task face holds no
   *  separate gate here: the WaveGate's wrong-phase verdict (the pre-flight) IS the
   *  task-face phase authority — the wave gate is the single phase authority. A
   *  doc line's gate is the reviewGate method family (T8 · §3.5 · judgment order =
   *  doc revision FIRST, shared by the lifecycle's frame phase so an opened gate
   *  dispatches): a moved doc opens the review lead whatever the round/route state
   *  says (fix after · backfill after · user-decision after are the SAME case — the
   *  stuck "next round is fix after an aborted fix" never freezes a revised doc),
   *  an unchanged doc yields the gate's "same" verdict — the pending fix DERIVED
   *  from the latest review's non-APPROVED conclusion opens only the fix phase,
   *  while the no-pending face falls back to the legacy rounds/routes judgment: a
   *  completed-fix line reopens the review lead through its fix round's C5-1 route
   *  (the lifecycle's own fall-through — an open gate and a dispatchable frame
   *  agree), a truly closed line keeps the revision-aware BLOCK. An unbound line
   *  (no identity on record / an unreadable doc) keeps the legacy round/route
   *  judgment + the generic closed message (only present facts land). */
  #lineGate(scene: WorkScene): {
    phase: DispatchPhase | null;
    verdict: "same" | "pending-fix" | null;
    reviewed: DocRevisionRef | null;
  } {
    if (scene.target?.kind === "doc") {
      const key = this.#lineKey(scene);
      if (key === null) return { phase: null, verdict: null, reviewed: null };
      const verdict = scene.ledger.reviewGate(key, scene.target.doc, scene.face.type);
      if (verdict.kind === "open") {
        return { phase: scene.face.product.reviewLead, verdict: null, reviewed: null };
      }
      if (verdict.kind === "same") {
        if (verdict.pending) {
          return { phase: "fix", verdict: "pending-fix", reviewed: verdict.reviewed };
        }
        // same + no pending fix — the legacy rounds/routes judgment (the lifecycle's
        // own fall-through): a completed-fix line reopens the review lead through its
        // fix round's C5-1 route; a truly closed line keeps the revision-aware BLOCK.
        const open = this.#linePhase(scene);
        return open !== null
          ? { phase: open, verdict: null, reviewed: null }
          : { phase: null, verdict: "same", reviewed: verdict.reviewed };
      }
    }
    const open = this.#linePhase(scene);
    return { phase: open, verdict: null, reviewed: null };
  }

  /** The doc line's revision-aware BLOCK message (T7/T8) — the unchanged-approved
   *  face: "{plan|spec} already reviewed at vX.Y (doc-hash …) — target revision
   *  unchanged; amend body/version to open a new review". Renders ONLY on the
   *  gate's "same" verdict — the approved identity the gate judged, whose reviewed
   *  ref the message names: the block consumes the verdict's identity, never a
   *  second ledger lookup (the face's judgment read points converge to the
   *  method family). Null off that face or with no identity ("target revision
   *  unchanged" is a present fact only there). */
  #docLineBlock(scene: WorkScene, reviewed: DocRevisionRef | null): string | null {
    if (reviewed === null || scene.target?.kind !== "doc") return null;
    const version = this.#docVersionOf(this.#docContent(scene.target.doc));
    return `${scene.type} already reviewed at ${version ?? "the current version"} (doc-hash ${reviewed.doc_hash.slice(0, 12)}…) — target revision unchanged; amend body/version to open a new review`;
  }

  /** The doc line's derived pending-fix note (T8) — the unchanged + non-APPROVED
   *  face: "the pending fix applies to the unchanged doc (doc-hash …) — run cdd
   *  fix first". Renders ONLY for the gate's "pending-fix" verdict — the derived
   *  fix-awaited face (a same-doc re-review stays refused until its fix lands,
   *  Review Convergence anti-spin); the message names the reviewed identity the
   *  gate judged. */
  #pendingFixBlock(scene: WorkScene, reviewed: DocRevisionRef | null): string | null {
    if (reviewed === null || scene.target?.kind !== "doc") return null;
    return `the pending fix applies to the unchanged doc (doc-hash ${reviewed.doc_hash.slice(0, 12)}…) — run cdd fix first`;
  }

  /** The doc's live content — readable doc else null. This helper backs the face's
   *  one remaining doc read site, the revision-aware BLOCK's version token — a read
   *  fired only when the BLOCK message actually renders (the version is raw doc
   *  grammar — zero parse dependence: the revision hash is a raw-content digest).
   *  The gate's own doc read lives in the ledger (Ledger#docLineVerdict — one read
   *  per reviewGate, the shared comparison). A BLOCK render is a run-failure prose
   *  channel — never a usage face — so the read is guarded here (null on unreadable),
   *  not routed through #readText's usage error. */
  #docContent(doc: string): string | null {
    try {
      return readFileSync(doc, "utf8");
    } catch {
      return null;
    }
  }

  /** The doc's `v<major>.<minor>` version token — the first token on the
   *  `**Version**` header line (the shared version-token grammar's one home —
   *  MarkdownPrimitives.versionTokensOf · contract/doc.ts). */
  #docVersionOf(content: string | null): string | null {
    if (content === null) return null;
    for (const line of content.split("\n")) {
      if (line.trimStart().startsWith("- **Version**:")) {
        return MarkdownPrimitives.versionTokensOf(line)[0] ?? null;
      }
    }
    return null;
  }

  /** The single-target line's current open phase — fix-awaits / re-review / closure
   *  read through the same ledger + router the lifecycle's line faces judge. */
  #linePhase(scene: WorkScene): DispatchPhase | null {
    const reviewLead = scene.face.product.reviewLead;
    const key = this.#lineKey(scene);
    if (key === null) return null;
    const reviews = scene.ledger.roundCount(key, reviewLead);
    const fixes = scene.ledger.roundCount(key, "fix");
    if (reviews === 0) return reviewLead;
    if (fixes < reviews) {
      const route = this.#lineRoundRoute(scene, reviews);
      return route?.kind === "fix" ? "fix" : null;
    }
    const route = this.#lineFixRoute(scene, fixes);
    return route?.kind === "review" ? reviewLead : null;
  }

  /** The line key of a fixed-target face — the branch line's STABLE key (find #9
   *  · spec §6.5 — `"branch"` per workspace, accumulating across re-reviews; the
   *  old form was the range short, its head moving every fix → new key → round
   *  reset to 1) or the doc path — the lifecycle's own key derivation (run.ts #lineKey). */
  #lineKey(scene: WorkScene): string | null {
    if (scene.target?.kind === "branch") return "branch";
    if (scene.target?.kind === "doc") return scene.target.doc;
    return null;
  }

  /** The official handoff params of a line round (the lifecycle's own per-face shape). */
  #lineParams(scene: WorkScene, round: number): HandoffParams {
    if (scene.target?.kind === "branch") {
      const ref = new BranchRef(scene.target.base, scene.target.head);
      return { base8: ref.base8, head8: ref.head8, round };
    }
    return { round };
  }

  /** The C5 route of a line's review-lead round (the fix-awaits decision). */
  #lineRoundRoute(scene: WorkScene, round: number): Route | null {
    const carried = scene.ledger.round(
      "review",
      scene.face.type,
      this.#lineParams(scene, round),
      round,
    );
    if (carried === null) return null;
    return scene.router.next(EMPTY_RUN_STATE, carried);
  }

  /** The C5 route of a line's fix round (the re-review/closure decision). */
  #lineFixRoute(scene: WorkScene, round: number): Route | null {
    const carried = scene.ledger.round(
      "fix",
      scene.face.type,
      this.#lineParams(scene, round),
      round,
    );
    if (carried === null) return null;
    return scene.router.next(EMPTY_RUN_STATE, carried);
  }

  /** The requested group ints — the normalized tasks value split. */
  #tasksOf(parsed: RunInput): number[] {
    return (parsed.args.tasks ?? "").split(",").map((part) => Number(part));
  }

  /** Render the task group brief into the workspace (the implement dispatch's input)
   *  — the brief's WAVE_BASE rides the current git HEAD. */
  #renderBrief(scene: WorkScene, parsed: RunInput): string {
    const tasks = this.#tasksOf(parsed);
    const content = this.#brief.render(scene.planText!, tasks, scene.head ?? "");
    const briefPath = scene.workspace.resolve(`tasks-${parsed.args.tasks}-brief.md`);
    writeFileSync(briefPath, content, "utf8");
    return briefPath;
  }

  /** The branch ref of a fix's source review handoff (--findings) — the derived
   *  identity (the review persisted its reviewed range in `commits`; the fix reads
   *  it back — the single-carrier rule). Unreadable/ref-less → null (the
   *  missing-refs gate then names the required declaration flags). */
  #refFromHandoff(findingsPath: string): BranchRef | null {
    try {
      return BranchRef.fromHandoff(readFileSync(findingsPath, "utf8"));
    } catch {
      return null; // unreadable → the missing-refs gate
    }
  }

  // ---------------------------------------------------------------------------
  // the work scene — the composition of contract/session/face objects
  // ---------------------------------------------------------------------------

  /** Assemble one work command's scene: the workspace (repo root + the plan/spec
   *  slug), the ledger, the run state (TaskGraph from the plan parse for the task
   *  face, the empty single-target state otherwise), the fixed target. */
  async #sceneOf(
    verb: CliVerb,
    type: TargetType,
    node: Command,
    parsed: RunInput,
  ): Promise<WorkScene> {
    const config = this.#config;
    const face = targetFaces[type];
    const repoRoot = await this.#repoRootOf(parsed);
    const root = new WorkspaceRoot(repoRoot, config.handoffNamespace().workspaceRoot);
    const planPath = parsed.args.plan ?? null;
    const specPath = parsed.args.spec ?? null;

    let slug: string;
    let planText: string | null = null;
    let target: WorkScene["target"] = null;
    switch (type) {
      case "wave": {
        if (planPath === null)
          this.#usage(node, `cdd ${verb} --type wave: missing required --plan <path>`);
        slug = Workspace.slugFromDoc(planPath);
        planText = this.#readText(node, planPath);
        break;
      }
      case "spec": {
        if (specPath === null)
          this.#usage(node, `cdd ${verb} --type spec: missing required --spec <path>`);
        slug = Workspace.slugFromDoc(specPath);
        target = { kind: "doc", doc: specPath };
        break;
      }
      case "plan": {
        if (planPath === null)
          this.#usage(node, `cdd ${verb} --type plan: missing required --plan <path>`);
        slug = Workspace.slugFromDoc(planPath);
        planText = this.#readText(node, planPath);
        target = { kind: "doc", doc: planPath };
        break;
      }
      case "branch": {
        // The branch ref is declared at ONE face — `cdd review --type branch
        // --base --head` (the range's birth face, 8-char flags). Every other
        // face derives it from a single carrier: the fix face reads its source
        // review handoff's `commits` (--findings) — zero extra CLI params (⑦ —
        // the old engine's fix channel; re-declaring the range on the fix CLI
        // was a dual identity that also made the face un-invokable).
        const ref =
          verb === "fix" && parsed.args.findings !== undefined
            ? this.#refFromHandoff(parsed.args.findings)
            : parsed.args.base !== undefined && parsed.args.head !== undefined
              ? new BranchRef(parsed.args.base, parsed.args.head)
              : null;
        if (ref === null) {
          this.#usage(
            node,
            `cdd ${verb} --type branch: missing required --base <sha> --head <sha>`,
          );
        }
        slug = planPath !== null ? Workspace.slugFromDoc(planPath) : ref.short();
        target = { kind: "branch", base: ref.base, head: ref.head };
        break;
      }
    }

    const workspace = new Workspace(root, slug).ensure();
    const ledger = new Ledger(workspace, config);
    const state =
      type === "wave"
        ? new TaskGraph(new PlanDocType("plan").parse(planText!.split("\n")))
        : EMPTY_RUN_STATE;
    return {
      workspace,
      ledger,
      planPath,
      planText,
      type,
      face,
      target,
      state,
      router: new NextStepRouter(),
      briefPath: null,
      head: await this.#git.revParseHead(repoRoot),
    };
  }

  /** The repo root — the --root override, else the injected root, else the git top
   *  level, else the cwd. */
  async #repoRootOf(parsed?: RunInput): Promise<string> {
    const override = parsed?.args.root;
    return override ?? this.#repoRoot ?? (await this.#git.topLevel(this.#cwd)) ?? this.#cwd;
  }

  // ---------------------------------------------------------------------------
  // the pure commands — schema / issue / base
  // ---------------------------------------------------------------------------

  /** `cdd schema get <type>` — the derived doc-structure schema JSON to stdout
   *  (the type vocabulary = the one shared schema-type table — `SCHEMA_TYPE_KEYS`
   *  in face/declare.ts: the primary DocKey spellings + the legacy alias normalized
   *  to kebab, spec §5.3); the `plan-graph` type rides the discovery read (§3.8).
   *  `cdd schema gen <type>` dispatches to the skeleton render (the schema verb's
   *  second leaf). */
  async #runSchema(node: Command, parsed: RunInput): Promise<number> {
    if (parsed.leaf === "gen") return this.#runSchemaGen(node, parsed);
    const type = parsed.positionals[0];
    if (type === undefined) this.#usage(node, "cdd schema get: missing <type>");
    if (type === "plan-graph") return this.#runPlanGraph(node, parsed);
    this.#io.stdout(`${JSON.stringify(this.#projector.schema()[type as DocKey], null, 2)}\n`);
    return 0;
  }

  /** `cdd schema gen <type>` — the derived doc skeleton to stdout (the pure-render
   *  discovery read of the schema verb's second leaf): the normalized DocType key →
   *  the projector's skeleton projection → the SkeletonAssembler bytes → the single
   *  appended newline (the assembler never appends one — the redirected fixture
   *  ends with exactly one `\n`). Zero write side-effects — the orchestrator
   *  redirects the stdout to the target path. */
  #runSchemaGen(node: Command, parsed: RunInput): number {
    const type = parsed.positionals[0];
    if (type === undefined) this.#usage(node, "cdd schema gen: missing <type>");
    const projection = this.#projector.skeleton()[type as DocKey];
    const date = this.#today();
    this.#io.stdout(`${new SkeletonAssembler(projection, date).render()}\n`);
    return 0;
  }

  /** The run date in `YYYY-MM-DD` — the skeleton's version-row date truth (the
   *  local day; the skeleton carries no date parameter face). */
  #today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  }

  /** `cdd schema get plan-graph --plan <path>` — the plan-graph read (§3.8): the task
   *  graph + the derived wave chain + the ledger progress, rendered as the engine-held
   *  wave-board (GraphView — one deterministic row per wave, zero third-party layout;
   *  the engine owns the node placement and the labels). A Graph validate failure
   *  BLOCKs the read with the named edge violations — the wave-preflight gate surfaces
   *  as a discovery read. The board's done face is the same closedWaves() the pre-flight
   *  gates judge. */
  async #runPlanGraph(node: Command, parsed: RunInput): Promise<number> {
    const planPath = parsed.args.plan;
    if (planPath === undefined) {
      this.#usage(node, "cdd schema get plan-graph: missing --plan <path>");
    }
    const text = this.#readText(node, planPath);
    const plan = new PlanDocType("plan").parse(text.split("\n"));
    const graph = new TaskGraph(plan);
    const issues = graph.validate();
    if (issues.length > 0) {
      this.#io.stderr(
        `cdd schema get plan-graph: ${issues.length} plan-graph violation(s) — fix the **DependsOn** edges first\n`,
      );
      for (const issue of issues)
        this.#io.stderr(`  ${issue.kind}@T${issue.task}: ${issue.message}\n`);
      return 1;
    }
    const repoRoot = await this.#repoRootOf(parsed);
    const workspace = new Workspace(
      new WorkspaceRoot(repoRoot ?? this.#cwd, this.#config.handoffNamespace().workspaceRoot),
      Workspace.slugFromDoc(planPath),
    ).ensure();
    const ledger = new Ledger(workspace, this.#config);
    // The board's done face = the C5 closure single read (v1.20): closedWaves() — the
    // same set the pre-flight gates judge, never "any ledger row is done".
    const done = ledger.closedWaves();
    this.#io.stdout(`${this.#graphView.render(graph.report(done), `plan-graph: ${planPath}`)}\n`);
    return 0;
  }

  /** `cdd issue render` — stdin findings JSON → the aggregate body → stdout (the
   *  renderer's only CLI entry; a bare call, no flags). */
  #runIssue(): number {
    let input: unknown;
    try {
      input = JSON.parse(this.#stdinRead());
    } catch (err) {
      this.#io.stderr(
        `cdd issue render: invalid input JSON — ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return 1;
    }
    const violations = this.#issue.validateInput(input);
    if (violations.length > 0) {
      this.#io.stderr(
        `cdd issue render: invalid input:\n${violations.map((v) => `  ${v}`).join("\n")}\n`,
      );
      return 1;
    }
    this.#io.stdout(`${this.#issue.renderBody(input as IssueReportInput)}\n`);
    return 0;
  }

  /** `cdd base <set|get> --plan <path>` — the base artifact read/write (T20: the
   *  command face `base`; the artifact file carries the base face too). */
  async #runBase(node: Command, parsed: RunInput): Promise<number> {
    const planPath = parsed.args.plan;
    if (planPath === undefined) {
      this.#usage(node, "cdd base: missing --plan — the sole target is --plan <path>");
    }
    const workspace = new Workspace(
      new WorkspaceRoot(
        await this.#repoRootOf(parsed),
        this.#config.handoffNamespace().workspaceRoot,
      ),
      Workspace.slugFromDoc(planPath),
    ).ensure();
    const path = workspace.resolve("base.json");
    if (parsed.leaf === "set") return this.#baseSet(node, parsed, planPath, path);
    if (parsed.leaf === "get") return this.#baseGet(path);
    this.#usage(node, "cdd base: missing <set|get> subcommand");
  }

  /** The `set` body — base/source required, a different existing base refuses without
   *  --force (the write-through artifact single-author). */
  #baseSet(node: Command, parsed: RunInput, planPath: string, path: string): number {
    const base = parsed.args.base;
    const source = parsed.args.source;
    if (base === undefined || source === undefined) {
      this.#usage(node, "cdd base set: required --base <branch> and --source <source>");
    }
    const existing = this.#readBase(path);
    if (existing !== null && existing.base !== base && parsed.args.force !== "true") {
      this.#usage(
        node,
        `cdd base set: base already set to ${existing.base} — pass --force to override`,
      );
    }
    const artifact: BaseArtifact = {
      base,
      source,
      plan: planPath,
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    this.#io.stdout(`${path}\n`);
    return 0;
  }

  /** The `get` body — read + validate + print the artifact JSON (exit 2 when the
   *  artifact is missing or corrupt — the orchestrator's inference-chain input). */
  #baseGet(path: string): number {
    const artifact = this.#readBase(path);
    if (artifact === null) {
      this.#io.stderr(`cdd base get: missing or corrupt base artifact at ${path}\n`);
      return 2;
    }
    this.#io.stdout(`${JSON.stringify(artifact, null, 2)}\n`);
    return 0;
  }

  /** Read + validate the base artifact; null when missing or malformed. */
  #readBase(path: string): BaseArtifact | null {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      if (
        typeof parsed.base !== "string" ||
        typeof parsed.source !== "string" ||
        typeof parsed.plan !== "string"
      )
        return null;
      return {
        base: parsed.base,
        source: parsed.source,
        plan: parsed.plan,
        recordedAt: typeof parsed.recordedAt === "string" ? parsed.recordedAt : "",
      };
    } catch {
      return null;
    }
  }

  /** Read a text file through the caller's command face; a missing/unreadable file is
   *  the usage error of that face (the owning node's commander-native usage line). */
  #readText(node: Command, file: string): string {
    try {
      return readFileSync(file, "utf8");
    } catch {
      this.#usage(node, `cannot read file: ${file}`);
    }
  }
}

// ---------------------------------------------------------------------------
// the composition root — the module's sole bare-function export
// ---------------------------------------------------------------------------

/**
 * cli(opts?) — the composition root: wires the engine's object graph (contract:
 * the projector over the declared registries · session: the ledger + lifecycle +
 * task graph + next router · face: the words + capsule · infra: the config loader +
 * git + the sync process seam) into the ONE Cli the bin thin entry boots. Every
 * collaborator is overridable for the hermetic test face (io / dispatch / repoRoot);
 * the defaults bind the living process.
 */
export function cli(opts: CliOptions = {}): Cli {
  return new Cli(opts);
}
