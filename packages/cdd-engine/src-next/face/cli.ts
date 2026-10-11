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
// channel, converged from the retired registry at T2) and the typed argv parse
// channel (face/argv.ts, the ArgvParser + the parsed/usage-error faces); the
// domain-run error face's usage bytes are the commander-native first lines of the
// projection (face/projection.ts — the CommandTreeBuilder the T3 rebuild consumes).
// This module keeps the RUN face: the dispatch seam (HarnessDispatch — the
// production default of the lifecycle's dispatch step), the work/pure command run
// bodies, the pre-flight orchestration and the render faces' separation (the
// renderers stay injected — the CLI orchestrates the call, never re-types their
// bytes), plus the help/`--help` display face — the self-built help render (the
// flag-level options · the sub-command tree · the examples · the top-level
// overview) and the error-path hints (Task 4 · design spec §4: the display
// product's renderer lives at the run face, zero runtime dependencies).
//
//   · Cli#parse — delegated to the shared ArgvParser (face/argv.ts).
//   · Cli#run — dispatch the parsed command to its run body. The work commands
//     (implement / review / fix) assemble the lifecycle (session/run), the capsule +
//     words (face), the ledger (session/ledger) and the task graph (contract parse)
//     and advance the requested phase; schema / issue / base run their pure
//     artifact surfaces through the same assembled objects (the issue body is
//     rendered by the IssueBodyRenderer the root assembles — render/issue-body.ts,
//     the P7 translation-system render landing).
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
import type { Command } from "commander";
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
import type { HandoffParams, LedgerKey, OpType, RoundStatus } from "../session/ledger.ts";
import { Ledger } from "../session/ledger.ts";
import type { Route } from "../session/next.ts";
import { NextStepRouter } from "../session/next.ts";
import type { PreFlightVerdict } from "../session/preflight.ts";
import { PreFlight } from "../session/preflight.ts";
import type { DispatchOutcome, DispatchStep, OpenFrame, RunState } from "../session/run.ts";
import { EMPTY_RUN_STATE, Lifecycle } from "../session/run.ts";
import { ArgvParser, CliUsageError, type ParsedCommand } from "./argv.ts";
import { Capsule } from "./capsule.ts";
import {
  type ChannelArg,
  CLI_COMMANDS,
  type CliCommandSpec,
  type CliLeafSpec,
  type CliVerb,
} from "./declare.ts";
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
// straight from that surface, and the parse/usage-error faces live in
// face/argv.ts)
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

/**
 * The Cli — the command face's parse/run surface over the assembled object graph.
 * parse() validates the command + component values and rejects unknown flags (the
 * guardArgs semantics); run() dispatches to the command's run body — the work verbs
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
  /** The typed argv parse face (face/argv.ts) — the resolved channel table + the
   *  doc-key vocabulary the parse reads; the run face passes the SAME channel
   *  table to the capsule (one flag-spelling source, never a hard-coded format). */
  readonly #parser: ArgvParser;
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
    this.#parser = new ArgvParser({
      config: this.#config,
      dryRun: this.#dryRun,
      docKeys: Object.keys(this.#projector.registries().schema),
    });
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
  // parse — delegated to the shared typed argv channel (face/argv.ts)
  // ---------------------------------------------------------------------------

  /** parse(argv) — delegate to the shared ArgvParser (the typed argv channel:
   *  tokenize + component-value validation + the unknown-flag guard). The round's
   *  help/dry-run program scopes resolve exactly as the parse face declares them.
   *  Throws CliUsageError (normalized by runArgv to usage + message + exit 2). */
  parse(raw: readonly string[]): ParsedCommand {
    return this.#parser.parse(raw);
  }

  // ---------------------------------------------------------------------------
  // run — the command dispatch
  // ---------------------------------------------------------------------------

  /** run(parsed) — dispatch to the command's run body; returns the exit code (0 =
   *  success, 1 = the round failed, 2 = a runtime usage/read error). */
  async run(parsed: ParsedCommand): Promise<number> {
    if (parsed.help) {
      const spec = CLI_COMMANDS.find((command) => command.name === parsed.verb);
      const surface = parsed.leafSpec ?? spec;
      if (surface !== undefined) this.#io.stdout(`${this.#renderHelp(parsed.verb, surface)}\n`);
      return 0;
    }
    switch (parsed.verb) {
      case "implement":
        return this.#runWork("implement", parsed);
      case "review":
        return this.#runWork("review", parsed);
      case "fix":
        return this.#runWork("fix", parsed);
      case "schema":
        return await this.#runSchema(parsed);
      case "issue":
        return this.#runIssue();
      case "base":
        return this.#runBase(parsed);
    }
  }

  /** runArgv(argv) — the CLI face: parse + run, with every CliUsageError normalized
   *  to the usage line + message on stderr and exit 2 (the steady exit-code table).
   *  A command-less invocation (bare `cdd`) renders the six-command OVERVIEW with
   *  the missing-command message merged on stdout — the exit code stays 2 (an
   *  overview at exit 0 would be a deliberate exit-code-table change, out of
   *  this phase's authority · design spec §4.1); every other usage error gains the
   *  smart error hint (the location's nearest suggestion, spec §4.4). */
  async runArgv(raw: readonly string[]): Promise<number> {
    try {
      return await this.run(this.parse(raw));
    } catch (err) {
      if (err instanceof CliUsageError) {
        if (err.message.startsWith("missing command")) {
          this.#io.stdout(`${this.#overview(err.message)}\n`);
          return 2;
        }
        this.#io.stderr(`${err.usage}\n`);
        this.#io.stderr(`${err.message}\n`);
        const hint = this.#usageHint(err);
        if (hint !== null) this.#io.stderr(`${hint}\n`);
        return 2;
      }
      this.#io.stderr(`cdd: ${err instanceof Error ? err.message : String(err)}\n`);
      return 1;
    }
  }

  // ---------------------------------------------------------------------------
  // the help/display face — the self-built render + the overview + the error hints
  // ---------------------------------------------------------------------------

  /** The commander-native usage first line of one command node — the projection's
   *  helpInformation() 首行 (the domain-run error face's usage byte; the self-built
   *  usage corpus is retired with the declaration rows at T2). The T3 rebuild
   *  closes every error surfaced onto the same program product. */
  #commanderUsage(verb: CliVerb): string {
    const node = this.#program.commands.find((command) => command.name() === verb);
    return node === undefined
      ? `Usage: cdd ${verb} [options]`
      : (node.helpInformation().split("\n")[0] ?? "");
  }

  /** The commander program usage first line — the bare-`cdd` overview face's usage
   *  anchor (`Usage: cdd [options] [command]` — the program's 首行). */
  #programUsage(): string {
    return this.#program.helpInformation().split("\n")[0] ?? "";
  }

  /** The per-command `--help` render (design spec §4.1 — the complete surface,
   *  never the old two-line patch): the commander-native usage first line
   *  (the projection's helpInformation() 首行 — the self-built usage corpus is
   *  retired) + the description + the flag-level options (the value domains +
   *  per-flag descriptions, single-sourced at the resolved channel table) + the
   *  sub-command tree (each leaf's option tokens) + one minimal example + the
   *  program-flag legend. Zero runtime dependencies (the do-not-re-add citty
   *  posture); the face is retired at T6 (the projection owns the help product). */
  #renderHelp(verb: CliVerb, surface: CliCommandSpec | CliLeafSpec): string {
    const lines: string[] = [this.#commanderUsage(verb), "", surface.description];
    if (surface.keys.length > 0) {
      lines.push("", "options:", ...this.#optionLines(surface));
    }
    if ("leaves" in surface && surface.leaves !== undefined && surface.leaves.length > 0) {
      lines.push("", "subcommands:");
      for (const leaf of surface.leaves) {
        lines.push(`  ${leaf.name}  ${leaf.description}`);
        const tokens = this.#leafTokens(leaf);
        if (tokens.length > 0) lines.push(`          options: ${tokens.join(" · ")}`);
      }
      const typeLeaves = surface.leaves.filter((leaf) =>
        (leaf.positionals ?? []).some((positional) => positional.key === "type"),
      );
      if (typeLeaves.length > 0) {
        const get = typeLeaves.some((leaf) => leaf.name === "get");
        lines.push("", `the <type> vocabulary: ${this.#typeDomain(get)}`);
      }
    }
    if ("example" in surface && surface.example !== undefined) {
      lines.push("", "example:", `  ${surface.example}`);
    }
    lines.push("", "program flags (accepted at any position): --dry-run · --help / -h");
    return lines.join("\n");
  }

  /** The option lines of a surface — the flag/value-domain/help columns (the
   *  schema leaves' positionals render as their `<key>` token). */
  #optionLines(surface: CliCommandSpec | CliLeafSpec): string[] {
    const rows: { token: string; help: string }[] = [];
    for (const declared of surface.keys) {
      const channel = this.#parser.channels()[declared.key];
      if (channel === undefined) continue;
      const domain = this.#domainOf(channel);
      const token = `${channel.flag}${domain === "" ? "" : ` ${domain}`}`;
      const help = `${channel.help ?? ""}${declared.required === true ? " (required)" : ""}`;
      rows.push({ token, help });
    }
    for (const positional of surface.positionals ?? []) {
      rows.push({
        token: `<${positional.key}>`,
        help: positional.required === true ? " (required)" : "",
      });
    }
    const width = rows.reduce((max, row) => Math.max(max, row.token.length), 0);
    return rows.map((row) => `  ${row.token.padEnd(width)}   ${row.help}`.trimEnd());
  }

  /** The leaf's compact option tokens — the sub-command tree's options row (a
   *  declared value-type override renders its own domain: base set's `--base`
   *  carries a branch name, never the review range's sha). */
  #leafTokens(leaf: CliLeafSpec): string[] {
    const tokens: string[] = [];
    for (const positional of leaf.positionals ?? []) tokens.push(`<${positional.key}>`);
    for (const declared of leaf.keys) {
      const channel = this.#parser.channels()[declared.key];
      if (channel === undefined) continue;
      const domain = declared.valueType === "branch" ? "<branch>" : this.#domainOf(channel);
      tokens.push(`${channel.flag}${domain === "" ? "" : ` ${domain}`}`);
    }
    return tokens;
  }

  /** The display value domain of a channel — the option column's `<…>` token. */
  #domainOf(channel: ChannelArg): string {
    switch (channel.type) {
      case "path":
        return "<path>";
      case "int-list":
        return "<n|n,n,…>";
      case "enum":
        return `<${[...(channel.values ?? [])].join("|")}>`;
      case "sha":
        return "<sha>";
      case "int":
        return "<n>";
      default:
        return "";
    }
  }

  /** The schema `<type>` value domain — the projector's doc-key set (+ the get
   *  leaf's plan-graph display route), the same vocabulary the parse face's error
   *  messages name, single-sourced at the projector. */
  #typeDomain(get: boolean): string {
    const keys = Object.keys(this.#projector.registries().schema);
    return get ? [...keys, "plan-graph"].join(" | ") : keys.join(" | ");
  }

  /** The top-level command overview (design spec §4.1) — the six-command glance
   *  (responsibility + the commander-native usage anchor each) with the
   *  missing-command message merged as the closing line (the bare-`cdd` face:
   *  overview + missing-command in ONE output, the exit code stays 2). */
  #overview(missing: string): string {
    const lines: string[] = [
      "cdd — the CDD engine's command line",
      "",
      this.#programUsage(),
      "",
      "commands:",
    ];
    for (const command of CLI_COMMANDS) {
      lines.push(
        `  ${command.name.padEnd(10)}${command.description} — ${this.#commanderUsage(command.name)}`,
      );
    }
    lines.push("", "run 'cdd <command> --help' for a command's flag-level help.", "", missing);
    return lines.join("\n");
  }

  /** The smart error-path hint (design spec §4.4) — one extra line naming the
   *  near miss: the nearest declared flag of an unknown option, the available
   *  leaves of an unknown subcommand, the expected value domain of a missing flag
   *  value. Null when the error carries no concrete suggestion. */
  #usageHint(err: CliUsageError): string | null {
    const unknown = /^unknown option: (\S+)/.exec(err.message);
    if (unknown !== null) {
      const near = this.#nearestFlag(unknown[1]!, err);
      return near === null ? null : `did you mean ${near}?`;
    }
    const subcommand = /^cdd (\w+): unknown subcommand: (\w+)/.exec(err.message);
    if (subcommand !== null) {
      const names = CLI_COMMANDS.find((command) => command.name === subcommand[1])?.leaves?.map(
        (leaf) => leaf.name,
      );
      if (names !== undefined && names.length > 0)
        return `available subcommands: ${names.join(" | ")}`;
      return null;
    }
    const missing = /missing (?:required|value for) (--\S+)/.exec(err.message);
    if (missing !== null) {
      const key = missing[1]!.replace(/^--/, "").split("=")[0]!;
      const channel = this.#parser.channels()[key];
      if (channel === undefined) return null;
      const domain = this.#domainOf(channel);
      return domain === "" ? null : `expected ${missing[1]} ${domain}`;
    }
    return null;
  }

  /** The declared flag nearest to a misspelled token (the unknown-option hint's
   *  suggestion) — the errored surface's own declared flags (the parse face
   *  attaches the command/leaf the error occurred on, so base get's candidates
   *  never include base set's --force), the full channel table only when no
   *  surface is in play (the pre-verb generic usage fallback), the program
   *  scopes always — judged within two edits. A did-you-mean never suggests a
   *  flag the same surface would reject as unknown. */
  #nearestFlag(token: string, err: CliUsageError): string | null {
    const candidates = new Set<string>();
    const surface = err.surface;
    if (surface === undefined) {
      for (const channel of Object.values(this.#parser.channels())) candidates.add(channel.flag);
    } else {
      for (const declared of surface.keys) {
        const channel = this.#parser.channels()[declared.key];
        if (channel !== undefined) candidates.add(channel.flag);
      }
    }
    // The program scopes (accepted at any position by the parse face) always join
    // the candidates — a legal suggestion in both the verb and pre-verb contexts.
    candidates.add("--dry-run");
    candidates.add("--no-dry-run");
    candidates.add("--help");
    candidates.add("-h");
    const name = token.split("=")[0]!;
    let best: string | null = null;
    let bestScore = 2;
    for (const candidate of candidates) {
      if (candidate === name) continue;
      const score = Cli.#distance(name, candidate);
      if (score <= bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  /** The edit distance between two short spellings — the near-miss metric. */
  static #distance(a: string, b: string): number {
    let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i += 1) {
      const row: number[] = [i];
      for (let j = 1; j <= b.length; j += 1) {
        row.push(
          Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)),
        );
      }
      prev = row;
    }
    return prev[b.length]!;
  }

  // ---------------------------------------------------------------------------
  // the work commands — lifecycle/capsule/ledger composition + the phase advance
  // ---------------------------------------------------------------------------

  /** One work command's run — assemble the scene, advance the requested phase (the
   *  lifecycle's single dispatch step per frame), render the capsule lines. */
  async #runWork(verb: CliVerb, parsed: ParsedCommand): Promise<number> {
    const type = (parsed.args.type ?? "wave") as TargetType;
    if (type === "wave" && parsed.args.tasks === undefined) {
      throw new CliUsageError(
        `cdd ${verb} --type wave: missing required --tasks <n|n,n,…>`,
        this.#commanderUsage(verb),
      );
    }
    const scene = await this.#sceneOf(verb, type, parsed);

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
          throw new CliUsageError(
            `cdd ${verb}: task ${id} not found in the plan`,
            this.#commanderUsage(verb),
          );
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
      capsule: new Capsule(this.#words, this.#parser.channels()),
      planPath: scene.planPath,
    });

    // The requested-phase gate — the line faces (branch/spec/plan) keep the
    // line-phase readiness check; the task face needs no second gate (the WaveGate's
    // wrong-phase verdict above IS the phase authority for the requested wave).
    if (group === null) {
      const { phase: open, verdict } = this.#lineGate(scene);
      if (open !== expected) {
        const docBlock = open === null ? this.#docLineBlock(scene, verdict) : null;
        this.#io.stderr(
          `cdd ${verb}: cannot dispatch a ${expected} round — ${docBlock ?? (open === null ? "the line holds no open round" : `the next round is ${open}${this.#phaseHint(open)}`)}\n`,
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
  #dispatchOf(scene: WorkScene, parsed: ParsedCommand): DispatchStep {
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

  /** The single-target line's current open phase (spec/plan/branch) plus the
   *  doc-line identity verdict the gate judged — the {phase, verdict} pair IS the
   *  gate's ruling: the revision-aware BLOCK renders only the "same" verdict the
   *  gate returned, never a recomputed one. The task face holds no separate gate
   *  here: the WaveGate's wrong-phase verdict (the pre-flight) IS the task-face
   *  phase authority — the wave gate is the single phase authority. A CLOSED doc
   *  line reopens through the identity-aware verdict (T7): the target's current
   *  doc revision vs the recorded reviewed revision — a moved doc reopens the
   *  review lead, an unchanged doc stays closed (the revision-aware BLOCK). */
  #lineGate(scene: WorkScene): { phase: DispatchPhase | null; verdict: "drift" | "same" | null } {
    const open = this.#linePhase(scene);
    if (open !== null) return { phase: open, verdict: null };
    const verdict = this.#docLineVerdict(scene);
    return { phase: verdict === "drift" ? scene.face.product.reviewLead : null, verdict };
  }

  /** The doc line's identity verdict (T7) — the ledger's single shared comparison
   *  (Ledger#docLineVerdict), consumed as-is: the drift gate and the revision-aware
   *  BLOCK read the SAME verdict, never a face-side recomputation. The face adds
   *  only the target reshape — null on non-doc, an absent key, an unreadable doc
   *  or no reviewed revision on record (the legacy closed face keeps its generic
   *  message). */
  #docLineVerdict(scene: WorkScene): "drift" | "same" | null {
    if (scene.target?.kind !== "doc") return null;
    const key = this.#lineKey(scene);
    if (key === null) return null;
    return scene.ledger.docLineVerdict(key, scene.target.doc);
  }

  /** The doc line's revision-aware BLOCK message (T7) — the unchanged-doc face:
   *  "{plan|spec} already reviewed at vX.Y (doc-hash …) — target revision
   *  unchanged; amend body/version to open a new review". Renders ONLY on the
   *  gate's "same" verdict — the one verdict whose doc read succeeded and matched
   *  the reviewed identity ("target revision unchanged" is a present fact there).
   *  The gate's null verdict (an unreadable target / no reviewed identity on
   *  record) keeps the generic "no open round" message — only present facts land
   *  (the ledger's own null contract, Ledger#docLineVerdict). Null off that face
   *  (the verdict arrives threaded from #lineGate, never recomputed). */
  #docLineBlock(scene: WorkScene, verdict: "drift" | "same" | null): string | null {
    if (verdict !== "same" || scene.target?.kind !== "doc") return null;
    // A "same" verdict implies a reviewed identity on record — the guard keeps the
    // dereference honest without an assertion.
    const reviewed = scene.ledger.reviewedDocRevisionOf(this.#lineKey(scene) as LedgerKey);
    if (reviewed === null) return null;
    const version = this.#docVersionOf(this.#docContent(scene.target.doc));
    return `${scene.type} already reviewed at ${version ?? "the current version"} (doc-hash ${reviewed.doc_hash.slice(0, 12)}…) — target revision unchanged; amend body/version to open a new review`;
  }

  /** The doc's live content — readable doc else null. The doc-line identity's
   *  read is the LEDGER's verdict read (Ledger#docLineVerdict — one read per
   *  gate); this helper backs the face's one remaining read site, the
   *  revision-aware BLOCK's version token — a read fired only when the BLOCK
   *  message actually renders (the version is raw doc grammar — zero parse
   *  dependence: the revision hash is a raw-content digest). */
  #docContent(doc: string): string | null {
    try {
      return this.#readText(doc);
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
  #tasksOf(parsed: ParsedCommand): number[] {
    return (parsed.args.tasks ?? "").split(",").map((part) => Number(part));
  }

  /** Render the task group brief into the workspace (the implement dispatch's input)
   *  — the brief's WAVE_BASE rides the current git HEAD. */
  #renderBrief(scene: WorkScene, parsed: ParsedCommand): string {
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
  async #sceneOf(verb: CliVerb, type: TargetType, parsed: ParsedCommand): Promise<WorkScene> {
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
          throw new CliUsageError(
            `cdd ${verb} --type wave: missing required --plan <path>`,
            this.#commanderUsage(verb),
          );
        slug = Workspace.slugFromDoc(planPath);
        planText = this.#readText(planPath);
        break;
      }
      case "spec": {
        if (specPath === null)
          throw new CliUsageError(
            `cdd ${verb} --type spec: missing required --spec <path>`,
            this.#commanderUsage(verb),
          );
        slug = Workspace.slugFromDoc(specPath);
        target = { kind: "doc", doc: specPath };
        break;
      }
      case "plan": {
        if (planPath === null)
          throw new CliUsageError(
            `cdd ${verb} --type plan: missing required --plan <path>`,
            this.#commanderUsage(verb),
          );
        slug = Workspace.slugFromDoc(planPath);
        planText = this.#readText(planPath);
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
          throw new CliUsageError(
            `cdd ${verb} --type branch: missing required --base <sha> --head <sha>`,
            this.#commanderUsage(verb),
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
  async #repoRootOf(parsed?: ParsedCommand): Promise<string> {
    const override = parsed?.args.root;
    return override ?? this.#repoRoot ?? (await this.#git.topLevel(this.#cwd)) ?? this.#cwd;
  }

  // ---------------------------------------------------------------------------
  // the pure commands — schema / issue / base
  // ---------------------------------------------------------------------------

  /** `cdd schema get <type>` — the derived doc-structure schema JSON to stdout
   *  (the type vocabulary = the one shared schema-type table — `SCHEMA_TYPE_KEYS`
   *  in face/argv.ts: the primary DocKey spellings + the legacy alias normalized
   *  to kebab, spec §5.3); the `plan-graph` type rides the discovery read (§3.8).
   *  `cdd schema gen <type>` dispatches to the skeleton render (the schema verb's
   *  second leaf). */
  async #runSchema(parsed: ParsedCommand): Promise<number> {
    if (parsed.leaf === "gen") return this.#runSchemaGen(parsed);
    const type = parsed.positionals[0];
    if (type === undefined)
      throw new CliUsageError("cdd schema get: missing <type>", this.#commanderUsage("schema"));
    if (type === "plan-graph") return this.#runPlanGraph(parsed);
    this.#io.stdout(`${JSON.stringify(this.#projector.schema()[type as DocKey], null, 2)}\n`);
    return 0;
  }

  /** `cdd schema gen <type>` — the derived doc skeleton to stdout (the pure-render
   *  discovery read of the schema verb's second leaf): the normalized DocType key →
   *  the projector's skeleton projection → the SkeletonAssembler bytes → the single
   *  appended newline (the assembler never appends one — the redirected fixture
   *  ends with exactly one `\n`). Zero write side-effects — the orchestrator
   *  redirects the stdout to the target path. */
  #runSchemaGen(parsed: ParsedCommand): number {
    const type = parsed.positionals[0];
    if (type === undefined)
      throw new CliUsageError("cdd schema gen: missing <type>", this.#commanderUsage("schema"));
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
  async #runPlanGraph(parsed: ParsedCommand): Promise<number> {
    const planPath = parsed.args.plan;
    if (planPath === undefined) {
      throw new CliUsageError(
        "cdd schema get plan-graph: missing --plan <path>",
        this.#commanderUsage("schema"),
      );
    }
    const text = this.#readText(planPath);
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
  async #runBase(parsed: ParsedCommand): Promise<number> {
    const planPath = parsed.args.plan;
    if (planPath === undefined) {
      throw new CliUsageError(
        "cdd base: missing --plan — the sole target is --plan <path>",
        this.#commanderUsage("base"),
      );
    }
    const workspace = new Workspace(
      new WorkspaceRoot(
        await this.#repoRootOf(parsed),
        this.#config.handoffNamespace().workspaceRoot,
      ),
      Workspace.slugFromDoc(planPath),
    ).ensure();
    const path = workspace.resolve("base.json");
    if (parsed.leaf === "set") return this.#baseSet(parsed, planPath, path);
    if (parsed.leaf === "get") return this.#baseGet(path);
    throw new CliUsageError("cdd base: missing <set|get> subcommand", this.#commanderUsage("base"));
  }

  /** The `set` body — base/source required, a different existing base refuses without
   *  --force (the write-through artifact single-author). */
  #baseSet(parsed: ParsedCommand, planPath: string, path: string): number {
    const base = parsed.args.base;
    const source = parsed.args.source;
    if (base === undefined || source === undefined) {
      throw new CliUsageError(
        "cdd base set: required --base <branch> and --source <source>",
        this.#commanderUsage("base"),
      );
    }
    const existing = this.#readBase(path);
    if (existing !== null && existing.base !== base && parsed.args.force !== "true") {
      throw new CliUsageError(
        `cdd base set: base already set to ${existing.base} — pass --force to override`,
        this.#commanderUsage("base"),
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

  /** Read a text file; a missing/unreadable file is the usage error of the caller. */
  #readText(file: string): string {
    try {
      return readFileSync(file, "utf8");
    } catch {
      throw new CliUsageError(`cannot read file: ${file}`, "usage: cdd <command> [options]");
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
