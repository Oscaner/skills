// packages/cdd-engine/src-next/face/cli.ts
// T11 — the command face + composition root (design spec §3.3: the cdd CLI command
// surface — implement / review / fix / schema / issue / base — is kept as a steady
// word face; T20 converges the base command face to `base` — the six-command surface
// unchanged in count). This module is the new tree's SOLE BARE ENTRY: the
// `cli` composition root (the module's one bare-function export, admitted by the
// plan's zero-bare-function discipline for composition roots) wires the contract /
// session / face objects into the ONE CLI the bin thin entry boots.
//
//   · the command registry — the six subcommand declarations (name · usage · the
//     declared arg keys). The flag spellings, value types and enum domains are NOT
//     a second hand-written list: every key resolves through the engine-config argv
//     channel (the single data source), so a channel rename fails the guard scan.
//   · Cli#parse — tokenize + component-value validation (int-list tasks, enum type /
//     source, sha base/head, int round) + the guardArgs semantics (every flag the
//     command did not declare is rejected — the acceptance's unknown-flag BLOCK).
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
import { declaredRegistries } from "../contract/declare.ts";
import { PlanDocType } from "../contract/doc.ts";
import type { DocKey } from "../contract/project.ts";
import { Projector } from "../contract/project.ts";
import { Translator } from "../contract/translate.ts";
import { ConfigLoader } from "../infra/config.ts";
import { GitClient } from "../infra/git.ts";
import type { HandoffFamily } from "../infra/runtime.ts";
import { Workspace, WorkspaceRoot } from "../infra/workspace.ts";
import { BriefRenderer } from "../render/brief.ts";
import { IssueBodyRenderer, type IssueReportInput } from "../render/issue-body.ts";
import type { TemplateValues, WorkMode } from "../render/templates.ts";
import { TemplateAssembler } from "../render/templates.ts";
import type { DispatchPhase, TargetFace, TargetType } from "../session/faces.ts";
import { targetFaces } from "../session/faces.ts";
import { TaskGraph } from "../session/graph.ts";
import type { HandoffSchemaFace } from "../session/handoff-schema.ts";
import { HandoffSchema } from "../session/handoff-schema.ts";
import type { HandoffParams, RoundStatus } from "../session/ledger.ts";
import { Ledger } from "../session/ledger.ts";
import type { Route } from "../session/next.ts";
import { NextStepRouter } from "../session/next.ts";
import type { DispatchOutcome, DispatchStep, OpenFrame, RunState } from "../session/run.ts";
import { EMPTY_RUN_STATE, Lifecycle } from "../session/run.ts";
import { Capsule } from "./capsule.ts";
import {
  DISPATCH,
  HOSTS,
  type HostDetectSpec,
  type HostId,
  type HostReferenceTable,
  REFS,
} from "./host.ts";
import { Words } from "./words.ts";

// ---------------------------------------------------------------------------
// the command-face vocabulary — the six steady subcommand words
// ---------------------------------------------------------------------------

/** The six subcommand words — the CLI command face (steady: implement · review ·
 *  fix · schema · issue · base). T20 converges the base command face: `cdd base
 *  set|get` rides the six-command surface (unchanged in count). */
export type CliVerb = "implement" | "review" | "fix" | "schema" | "issue" | "base";

/** The nested leaf words — the sub-command surfaces of the pure commands. */
export type CliLeafName = "get" | "set" | "render";

/** The per-command usage lines — the steady consumption face (byte-stable across
 *  the tree generations; a typo in a usage line is a red consumer-side test). */
export const CLI_USAGE: Record<CliVerb, string> = {
  implement: "usage: cdd implement --tasks <n|n,n,…> --plan <path>",
  review:
    "usage: cdd review --type <task|branch|spec|plan> [--tasks <n|n,n,…>] (--plan <path> | --spec <path> | branch: --base <sha> --head <sha>) [--round <n>]",
  fix: "usage: cdd fix --type <task|branch|spec|plan> [--tasks <n|n,n,…>] [--findings <path>] (--plan <path> | --spec <path>)",
  base: "usage: cdd base <set|get> --plan <path> [set: --base <branch> --source <source>] [--force]",
  schema: "usage: cdd schema get <type>",
  issue: "usage: cdd issue render",
};

/** The component-value types of the argv channel (the engine-config type names). */
export type ChannelValueType = "string" | "path" | "int-list" | "enum" | "sha" | "int" | "bool";

/** One argv-channel entry — the declared flag / type / enum domain of one key. */
export interface ChannelArg {
  /** The canonical key (tasks / type / plan / …). */
  key: string;
  /** The `--flag` spelling. */
  flag: string;
  /** The value type (the engine-config channel type). */
  type: ChannelValueType;
  /** The enum domain, when the type is enum. */
  values?: readonly string[];
}

// ---------------------------------------------------------------------------
// the command registry — the six subcommand declarations
// ---------------------------------------------------------------------------

/** A per-command value-type override — a declared key whose value shape differs
 *  from the channel's global typing for that key (base set's `--base` carries
 *  a branch name, never the review range's 40-char sha). */
export type CliValueOverride = "branch";

/** One declared arg of a command — the key + how strictly the run requires it. */
export interface CliArgSpec {
  /** The canonical engine-config argv-channel key. */
  key: string;
  /** Whether the run requires the value (enforced at parse). */
  required?: boolean;
  /** The value-type override (only where the command's use differs from the channel). */
  valueType?: CliValueOverride;
}

/** One nested leaf command (base set|get · schema get · issue render). */
export interface CliLeafSpec {
  name: CliLeafName;
  usage: string;
  description: string;
  keys: readonly CliArgSpec[];
  positionals?: readonly CliArgSpec[];
}

/** One subcommand declaration — the command face's data row. */
export interface CliCommandSpec {
  name: CliVerb;
  usage: string;
  description: string;
  keys: readonly CliArgSpec[];
  positionals?: readonly CliArgSpec[];
  leaves?: readonly CliLeafSpec[];
}

/** The six subcommand declarations — implement, review, fix (the lifecycle work
 *  commands) plus the pure base / schema / issue artifact commands. */
export const CLI_COMMANDS: readonly CliCommandSpec[] = [
  {
    name: "implement",
    usage: CLI_USAGE.implement,
    description: "run the task implement phase",
    keys: [{ key: "tasks", required: true }, { key: "plan", required: true }, { key: "root" }],
  },
  {
    name: "review",
    usage: CLI_USAGE.review,
    description: "run a review — task | branch | spec | plan",
    keys: [
      { key: "type", required: true },
      { key: "tasks" },
      { key: "plan" },
      { key: "spec" },
      { key: "base" },
      { key: "head" },
      { key: "round" },
      { key: "root" },
    ],
  },
  {
    name: "fix",
    usage: CLI_USAGE.fix,
    description: "fix review findings — task | branch | spec | plan",
    keys: [
      { key: "type", required: true },
      { key: "tasks" },
      { key: "findings" },
      { key: "spec" },
      { key: "plan" },
      { key: "root" },
    ],
  },
  {
    name: "base",
    usage: CLI_USAGE.base,
    description: "read/write base.json (single CDD --plan target)",
    keys: [],
    leaves: [
      {
        name: "set",
        usage: CLI_USAGE.base,
        description: "write the base artifact",
        keys: [
          { key: "plan", required: true },
          { key: "base", required: true, valueType: "branch" },
          { key: "source", required: true },
          { key: "force" },
        ],
      },
      {
        name: "get",
        usage: CLI_USAGE.base,
        description: "read the base artifact",
        keys: [{ key: "plan", required: true }],
      },
    ],
  },
  {
    name: "schema",
    usage: CLI_USAGE.schema,
    description: "read canonical doc-structure schemas (discovery, zero enforcement)",
    keys: [],
    leaves: [
      {
        name: "get",
        usage: CLI_USAGE.schema,
        description: "print the derived doc-structure schema for <type>",
        keys: [],
        positionals: [{ key: "type", required: true }],
      },
    ],
  },
  {
    name: "issue",
    usage: CLI_USAGE.issue,
    description: "aggregate issue-body rendering (cdd issue render, zero enforcement)",
    keys: [],
    leaves: [
      {
        name: "render",
        usage: CLI_USAGE.issue,
        description: "render the aggregate issue body (stdin findings JSON → stdout)",
        keys: [],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// the parse/run result + error surfaces
// ---------------------------------------------------------------------------

/** One parsed command — the validated verb + values (undefined = the flag absent). */
export interface ParsedCommand {
  verb: CliVerb;
  leaf: CliLeafName | null;
  leafSpec: CliLeafSpec | null;
  args: Record<string, string>;
  positionals: readonly string[];
  dryRun: boolean;
  help: boolean;
}

/** The usage-error surface — parse rejects with the command's usage line attached
 *  (the run face prints `usage` then the message and exits 2 — the steady exit-code
 *  table's usage row). */
export class CliUsageError extends Error {
  readonly usage: string;

  constructor(message: string, usage: string) {
    super(message);
    this.usage = usage;
  }
}

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
  #opOf(frame: OpenFrame): "implement" | "review" | "fix" {
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

  /** The phase's skill-ref slash form for the detected host ("/mattpocock-skills:tdd"
   *  etc.); null when the dispatch table names a URC prose instead of a ref (the
   *  spec/plan reviews — the prose rides INPUT_CRITERIA, no slash arg). */
  #skillRef(host: string, frame: OpenFrame): string | null {
    const dispatch = DISPATCH;
    let ref: unknown = null;
    if (frame.phase === "review" || frame.phase === "branch-review") {
      // The task/branch rows are object-shaped {ref}; the spec/plan rows stay the URC
      // prose string. The slash form resolves from the row's ref either way, falling
      // back to null for the prose-only rows (the review criteria ride INPUT_CRITERIA).
      const entry = dispatch.review[frame.type];
      const declaredRef = typeof entry === "string" ? entry : entry.ref;
      ref =
        typeof declaredRef === "string" && declaredRef.startsWith("mattpocock-skills:")
          ? declaredRef
          : null;
    } else {
      const value = dispatch[frame.phase as "implement" | "fix"];
      ref = typeof value === "string" ? value : null;
    }
    if (typeof ref !== "string") return null;
    const hostForm = (REFS as HostReferenceTable)[ref]?.[host as HostId];
    return hostForm ?? null;
  }

  /** The child's single prompt argument — per the host's promptForm data contract
   *  (§3.5): the ref-prefixed form embeds the skill-ref slash form at the start of
   *  the assembled dispatch prompt as one positional (`/kairos:cdd-* <prompt>`); the
   *  plain form passes the prompt verbatim (the URC-prose rows carry no ref). */
  #childPrompt(form: "ref-prefixed" | "plain", ref: string | null, prompt: string): string {
    return form === "ref-prefixed" && ref !== null ? `${ref} ${prompt}` : prompt;
  }

  /** The review-axes text — the typed review criteria the assembly face references:
   *  the task/branch axes guide (render/templates.ts — the four axes + the
   *  verification-evidence duty) or the spec/plan URC prose row (the dispatch table,
   *  host.ts); empty outside review frames. */
  #reviewAxes(frame: OpenFrame): string {
    if (frame.type === "task" || frame.type === "branch") {
      return this.#template.reviewGuide(frame.type).axesGuide;
    }
    const entry = DISPATCH.review[frame.type];
    return typeof entry === "string" ? entry : "";
  }

  /** The round-context zone values of the dispatch prompt (the v1.8 naming contract:
   *  ROLE/SCOPE nominatives · INPUT_* read-side · OUTPUT_* write-side · WORKSPACE_*
   *  environment · FIX_BASE anchor). Every declared token supplied — a mode's
   *  non-consumed slots stay empty and are NOT emitted by the assembler (empty-valued keys are dropped),
   *  so each mode's round context carries only the facts the mode reads. */
  #valuesOf(frame: OpenFrame): TemplateValues {
    const scene = this.#scene;
    const op = this.#opOf(frame);
    const role = this.#roleOf(frame);
    const params = frame.params;
    const isReview = frame.phase === "review" || frame.phase === "branch-review";
    const docPath = frame.target.kind === "doc" ? frame.target.doc : null;
    const branchRange =
      frame.target.kind === "branch"
        ? `${frame.target.base.slice(0, 7)}..${frame.target.head.slice(0, 7)}`
        : null;
    const reference =
      frame.target.kind === "branch"
        ? `${frame.target.base}..${frame.target.head}`
        : (docPath ?? scene.planPath ?? "");
    const scope = params.tasks ?? branchRange ?? docPath ?? scene.planPath ?? frame.type;
    return {
      ROLE: role,
      SCOPE: scope,
      INPUT_TASK: this.#taskInput(frame, scene, op),
      INPUT_RULES: scene.workspace.resolve("plan-constraints.md"),
      // v1.9: INPUT_FINDINGS is fix/docs-fix only — the open findings of the source
      // review; a review writes its own draft (INPUT_FINDINGS === OUTPUT_HANDOFF
      // would be a short-circuit).
      INPUT_FINDINGS:
        op === "fix"
          ? (this.#findings ?? scene.ledger.handoffPath("review", frame.type, params))
          : "",
      INPUT_CRITERIA: isReview ? this.#reviewAxes(frame) : "",
      INPUT_RANGE: isReview ? reference : "",
      INPUT_LENS:
        isReview && (frame.type === "task" || frame.type === "branch")
          ? this.#template.reviewGuide(frame.type).lensEnum.join(" | ")
          : "",
      INPUT_PLAN: scene.planPath !== null ? `**Plan:** ${scene.planPath}` : "",
      INPUT_DOC: docPath ?? "",
      OUTPUT_HANDOFF: scene.ledger.handoffPath(op, frame.type, params),
      FIX_BASE: op === "fix" ? this.#fixedPoint(frame, params) : "",
      WORKSPACE_DIR: scene.workspace.path,
      WORKSPACE_ID: scene.workspace.slug,
      // v1.9 — the injected writable-subset schema (projection ①): the `## Handoff
      // schema` section of the mode's fixed prefix (byte-stable per mode; the work
      // faces — implement/fix — carry the evidence-file fence too).
      HANDOFF_SCHEMA: this.#schemaText(frame),
    };
  }

  /** The round's task-brief input — the rendered brief (implement) or the prior
   *  implement round's brief file (task fixes — it exists on disk after the
   *  implement dispatch). "" outside the task work rounds; only present facts land. */
  #taskInput(frame: OpenFrame, scene: DispatchScene, op: string): string {
    if (op === "implement") return scene.briefPath ?? "";
    if (op === "fix" && frame.type === "task") {
      const brief = scene.workspace.resolve(`tasks-${frame.params.tasks}-brief.md`);
      return existsSync(brief) ? brief : "";
    }
    return "";
  }

  /** The scope token of a branch frame — the {base7}..{head7} range (the evidence
   *  file name's `tasks-{SCOPE}-` spine for branch-family work rounds). */
  #scopeOf(frame: OpenFrame): string {
    if (frame.target.kind === "branch") {
      return `${frame.target.base.slice(0, 7)}..${frame.target.head.slice(0, 7)}`;
    }
    return "";
  }

  /** The fix round's fixed point — the source review's reviewed base (only present
   *  facts land: an unreadable source review yields the empty slot, never a guess). */
  #fixedPoint(frame: OpenFrame, params: OpenFrame["params"]): string {
    const carried = this.#scene.ledger.readHandoff("review", frame.type, params);
    const base = (carried?.commits as { base?: unknown } | undefined)?.base;
    return typeof base === "string" ? base : "";
  }

  /** The RETURN_STDOUT_BLOCK child stdout → the outcome: the three canonical lines
   *  (status / commits / artifacts), each key=value tokens; a missing status line is
   *  a BLOCKED outcome (only present facts land). */
  #parseBlockReturn(stdout: string): DispatchOutcome {
    const status = stdout.match(/^status:\s*(\S+)/m)?.[1];
    if (status === undefined) return { status: "BLOCKED" };
    const outcome: DispatchOutcome = { status: status as RoundStatus };
    const commits = stdout.match(/^commits:\s*base=([0-9a-f]{40})(?:\s+head=([0-9a-f]{40}))?/m);
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
    const schema = new HandoffSchema();
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
    // the canonical `tasks-{SCOPE}-test-evidence.json` under the workspace; the docs
    // faces (review/docs-fix) carry no evidence file. The read-back is REAL — a
    // missing/schema-violating file rewrites the draft to BLOCKED.
    if (face === "work") {
      const scope = frame.params.tasks ?? this.#scopeOf(frame);
      const evidenceName = `tasks-${scope}-test-evidence.json`;
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
      carrier: this.#materialize(frame, op, face, draft, status, reason),
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

  /** Build the final carrier — the engine identity (phase / tasks — the family's
   *  reserved fields) + the validated writable fields from the draft, persisted by
   *  the bookkeep full-replace at the SAME path (agent draft → finalized). The
   *  evidence override rewrites the status to BLOCKED + a failure_category + the
   *  reason note (the child's work preserved, marked bad). */
  #materialize(
    frame: OpenFrame,
    op: "implement" | "review" | "fix",
    face: HandoffSchemaFace,
    draft: Record<string, unknown>,
    status: RoundStatus,
    reason: string | null,
  ): Record<string, unknown> {
    const ledger = this.#scene.ledger;
    const carrier = ledger.buildHandoff(op, frame.type, frame.params, {
      artifacts: this.#stringMap(draft.artifacts),
      findings: face === "findings" ? this.#findingsList(draft.findings) : [],
      commits: this.#commitsOf(draft.commits),
    });
    carrier.status = status;
    if (Array.isArray(draft.changes)) carrier.changes = draft.changes;
    if (typeof draft.failure_category === "string")
      carrier.failure_category = draft.failure_category;
    const notes = Array.isArray(draft.notes) ? [...(draft.notes as unknown[])] : [];
    if (reason !== null) {
      carrier.status = "BLOCKED";
      carrier.failure_category = "evidence-contract";
      notes.push(reason);
    }
    if (notes.length > 0) carrier.notes = notes;
    return carrier;
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
    return new HandoffSchema().schemaText(face, evidence);
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
        return `cdd review --type branch --base ${range.base} --head ${range.head}`;
      }
      case "review":
        if (frame.type === "spec") return `cdd review --type spec --spec ${this.#docOf(frame)}`;
        if (frame.type === "plan") return `cdd review --type plan --plan ${this.#docOf(frame)}`;
        return `cdd review --type task --tasks ${frame.params.tasks ?? ""} --plan ${plan}`;
      case "fix": {
        const findings = scene.ledger.handoffPath("review", frame.type, frame.params);
        const target =
          frame.target.kind === "doc"
            ? `--${frame.type === "spec" ? "spec" : "plan"} ${frame.target.doc}`
            : frame.target.kind === "branch"
              ? `--base ${frame.target.base} --head ${frame.target.head}`
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
  readonly #channels: Record<string, ChannelArg>;
  readonly #docKeys: readonly string[];

  constructor(opts: CliOptions = {}) {
    this.#io = opts.io ?? {
      stdout: (t) => process.stdout.write(t),
      stderr: (t) => process.stderr.write(t),
    };
    this.#config = opts.config ?? new ConfigLoader();
    this.#words = opts.words ?? new Words();
    this.#projector = opts.projector ?? new Projector(declaredRegistries);
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
    this.#channels = this.#channelTable();
    this.#docKeys = Object.keys(this.#projector.registries().schema);
  }

  // ---------------------------------------------------------------------------
  // parse — tokenize + component validation + the unknown-flag guard
  // ---------------------------------------------------------------------------

  /** parse(argv) — the verb → (leaf) → flag/positional scan: every flag checked
   *  against the command's declared keys (the engine-config argv channel is the
   *  single flag/type source), every value validated by its component type, program
   *  scopes (−-dry-run / −-help) accepted at any position. Throws CliUsageError. */
  parse(raw: readonly string[]): ParsedCommand {
    const toks = [...raw];
    let dryRun = this.#dryRun;
    const help = toks.includes("--help") || toks.includes("-h");

    // The verb — the first non-flag token; anything before it must be program-level.
    let index = 0;
    while (index < toks.length && toks[index]!.startsWith("-")) {
      const name = this.#flagName(toks[index]!);
      if (name === "dry-run" || name === "no-dry-run" || name === "help" || name === "h") {
        if (name === "dry-run") dryRun = true;
        else if (name === "no-dry-run") dryRun = false;
        index += 1;
        continue;
      }
      throw this.#usage(`unknown option: ${toks[index]}`, "usage: cdd <command> [options]");
    }
    const verbWord = toks[index];
    const spec =
      typeof verbWord === "string"
        ? CLI_COMMANDS.find((command) => command.name === verbWord)
        : undefined;
    if (spec === undefined) {
      throw this.#usage(
        typeof verbWord === "string"
          ? `unknown command: ${verbWord}`
          : "missing command — expected implement | review | fix | base | schema | issue",
        "usage: cdd <command> [options]",
      );
    }
    index += 1;

    // The help pre-screen — a help flag anywhere pre-empts the leaf/argument scan
    // (the steady `cdd <command> --help` face renders the command's usage, never a
    // missing-subcommand or required-value error on top of the help the user asked
    // for — `cdd base --help` shows the leaf command's usage, no leaf word).
    if (help) {
      return {
        verb: spec.name,
        leaf: null,
        leafSpec: null,
        args: {},
        positionals: [],
        dryRun,
        help,
      };
    }

    // The nested leaf (base set|get · schema get · issue render).
    let leafSpec: CliLeafSpec | null = null;
    if (spec.leaves !== undefined) {
      const leafWord = toks[index];
      if (leafWord === undefined || leafWord.startsWith("-")) {
        throw this.#usage(
          `cdd ${spec.name}: missing subcommand — ${spec.leaves.map((l) => l.name).join(" | ")}`,
          spec.usage,
        );
      }
      leafSpec = spec.leaves.find((l) => l.name === leafWord) ?? null;
      if (leafSpec === null)
        throw this.#usage(`cdd ${spec.name}: unknown subcommand: ${leafWord}`, spec.usage);
      index += 1;
    }
    const surface = leafSpec ?? spec;

    // The flag/positional scan.
    const args: Record<string, string> = {};
    const positionals: string[] = [];
    for (; index < toks.length; index += 1) {
      const tok = toks[index]!;
      if (tok === "--") {
        positionals.push(...toks.slice(index + 1));
        break;
      }
      if (!tok.startsWith("-")) {
        positionals.push(tok);
        continue;
      }
      const eq = tok.indexOf("=");
      const flag = eq === -1 ? tok : tok.slice(0, eq);
      const inline = eq === -1 ? null : tok.slice(eq + 1);
      const norm = this.#flagName(flag);
      if (norm === "dry-run" || norm === "no-dry-run" || norm === "help" || norm === "h") {
        if (inline !== null) throw this.#usage(`unexpected value for ${flag}`, surface.usage);
        if (norm === "dry-run") dryRun = true;
        else if (norm === "no-dry-run") dryRun = false;
        continue;
      }
      const key = this.#declaredKey(surface, norm);
      const channel = key === null ? undefined : this.#channels[key];
      if (key === null || channel === undefined)
        throw this.#usage(`unknown option: ${tok}`, surface.usage);
      let value: string;
      if (channel.type === "bool") {
        if (inline !== null) throw this.#usage(`unexpected value for ${flag}`, surface.usage);
        value = norm.startsWith("no-") ? "false" : "true";
      } else if (inline !== null) {
        value = inline;
      } else {
        index += 1;
        value = toks[index] ?? "";
        if (value.length === 0) throw this.#usage(`missing value for ${flag}`, surface.usage);
      }
      args[key] = this.#validate(spec, surface, key, channel, value);
    }

    // Required declared keys + positionals; extra positionals rejected.
    for (const declared of surface.keys) {
      if (declared.required === true && args[declared.key] === undefined) {
        const flag = this.#channels[declared.key]?.flag ?? `--${declared.key}`;
        throw this.#usage(`cdd ${spec.name}: missing required ${flag}`, surface.usage);
      }
    }
    for (const positional of surface.positionals ?? []) {
      if (positional.required === true && positionals.length === 0) {
        throw this.#usage(`cdd ${spec.name}: missing required <${positional.key}>`, surface.usage);
      }
    }
    if ((surface.positionals ?? []).length < positionals.length) {
      throw this.#usage(
        `cdd ${spec.name}: unexpected argument: ${positionals[(surface.positionals ?? []).length]}`,
        surface.usage,
      );
    }

    return {
      verb: spec.name,
      leaf: leafSpec?.name ?? null,
      leafSpec,
      args,
      positionals: this.#positionalsOf(surface, positionals),
      dryRun,
      help,
    };
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
      if (surface !== undefined) this.#io.stdout(`${surface.usage}\n${surface.description}\n`);
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
        return this.#runSchema(parsed);
      case "issue":
        return this.#runIssue(parsed);
      case "base":
        return this.#runBase(parsed);
    }
  }

  /** runArgv(argv) — the CLI face: parse + run, with every CliUsageError normalized
   *  to the usage line + message on stderr and exit 2 (the steady exit-code table). */
  async runArgv(raw: readonly string[]): Promise<number> {
    try {
      return await this.run(this.parse(raw));
    } catch (err) {
      if (err instanceof CliUsageError) {
        this.#io.stderr(`${err.usage}\n`);
        this.#io.stderr(`${err.message}\n`);
        return 2;
      }
      this.#io.stderr(`cdd: ${err instanceof Error ? err.message : String(err)}\n`);
      return 1;
    }
  }

  // ---------------------------------------------------------------------------
  // the work commands — lifecycle/capsule/ledger composition + the phase advance
  // ---------------------------------------------------------------------------

  /** One work command's run — assemble the scene, advance the requested phase (the
   *  lifecycle's single dispatch step per frame), render the capsule lines. */
  async #runWork(verb: CliVerb, parsed: ParsedCommand): Promise<number> {
    const type = (parsed.args.type ?? "task") as TargetType;
    if (type === "task" && parsed.args.tasks === undefined) {
      throw new CliUsageError(
        `cdd ${verb} --type task: missing required --tasks <n|n,n,…>`,
        CLI_USAGE[verb],
      );
    }
    const scene = await this.#sceneOf(verb, type, parsed);
    if (verb === "implement" && scene.planText !== null)
      scene.briefPath = this.#renderBrief(scene, parsed);
    const expected =
      verb === "implement" ? "implement" : verb === "fix" ? "fix" : scene.face.product.reviewLead;

    // The per-invocation batch cursor: every non-group task pre-done, so the frontier
    // yields exactly the requested group (in-memory only — the ledger is the on-disk
    // record; the next invocation re-derives the phase from the ledger).
    let group: Set<number> | null = null;
    if (type === "task") {
      group = new Set(this.#tasksOf(parsed));
      const planIds =
        scene.planText !== null
          ? new PlanDocType("plan")
              .parse(scene.planText.split("\n"))
              .taskBlocks.map((block) => block.id)
          : [];
      for (const id of group) {
        if (!planIds.includes(id)) {
          throw new CliUsageError(`cdd ${verb}: task ${id} not found in the plan`, CLI_USAGE[verb]);
        }
      }
      for (const id of planIds) if (!group.has(id)) scene.state.markDone(id);
    }

    const statuses: (RoundStatus | null)[] = [];
    const dispatch: DispatchStep = this.#dispatchOf(scene, parsed);
    const run = new Lifecycle({
      face: scene.face,
      state: scene.state,
      ledger: scene.ledger,
      router: scene.router,
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
      capsule: new Capsule(this.#words),
    });

    // The requested-phase gate — the line's current open phase must BE the requested
    // verb's round before any advance (a review before implement refrains, never a
    // phantom implement round).
    const open = group !== null ? this.#taskGate(scene, group, expected) : this.#lineGate(scene);
    if (open !== expected) {
      this.#io.stderr(
        `cdd ${verb}: cannot dispatch a ${expected} round — ${open === null ? "the line holds no open round" : `the next round is ${open}${this.#phaseHint(open)}`}\n`,
      );
      return 1;
    }

    // Advance the requested phase across the group (one dispatch per frame — the
    // lifecycle's "one dispatch, one advance" step), keeping only the LAST step's
    // capsule for the invocation's single stdout face (the per-step intermediate
    // next-group lines stay in the router, never on the CLI face).
    let dispatched = 0;
    let latest: readonly string[] = [];
    for (;;) {
      const step = run.advance();
      if (step === null) break;
      const taskId = step.frame.target.kind === "task" ? step.frame.target.task : null;
      const mismatch =
        step.frame.phase !== expected ||
        (group !== null && (taskId === null || !group.has(taskId)));
      if (mismatch) {
        if (dispatched === 0) {
          this.#io.stderr(
            `cdd ${verb}: cannot dispatch a ${expected} round — the next round is ${step.frame.phase}${taskId !== null ? ` for task ${taskId}` : ""}${this.#phaseHint(step.frame.phase)}\n`,
          );
          return 1;
        }
        break;
      }
      dispatched += 1;
      latest = step.capsuleLines;
      if (taskId !== null && group !== null) scene.state.markDone(taskId);
      if (statuses.some((status) => status === "BLOCKED" || status === "TIMEOUT")) {
        for (const line of latest) this.#io.stdout(`${line}\n`);
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

  // ---------------------------------------------------------------------------
  // the requested-phase gate — the work commands' readiness check
  // ---------------------------------------------------------------------------

  /** The group's current open phase — the gate's verdict for a task-face group: the
   *  requested phase, or the phase the line is actually at (null = a closed line).
   *  Every group task must be at the same open phase — a mixed group (one task
   *  already advanced) is refused as a stale group re-run. */
  #taskGate(
    scene: WorkScene,
    group: ReadonlySet<number>,
    expected: DispatchPhase,
  ): DispatchPhase | null {
    let verdict: DispatchPhase | null = expected;
    for (const task of group) {
      const phase = this.#taskPhase(scene.ledger, scene.router, task);
      if (phase !== expected) {
        verdict = phase ?? null;
        if (phase !== null) return verdict;
      }
    }
    return verdict;
  }

  /** The single-target line's current open phase (spec/plan/branch). */
  #lineGate(scene: WorkScene): DispatchPhase | null {
    return this.#linePhase(scene);
  }

  /**
   * The ledger-derived open phase of a task — the requested-phase gate's rule: the
   * implement → review → fix → re-review progression read through the SAME ledger and
   * the SAME stateless NextStepRouter the lifecycle (T8) judges. This gate is the
   * CLI's refusal authority, never a second phase table — the phase-sequence tests
   * pin it against the lifecycle's own opening behavior, so a drift fails loudly.
   */
  #taskPhase(ledger: Ledger, router: NextStepRouter, task: number): DispatchPhase | null {
    const implemented = ledger.roundCount(task, "implement");
    const reviews = ledger.roundCount(task, "review");
    const fixes = ledger.roundCount(task, "fix");
    if (implemented === 0) return "implement";
    if (reviews === 0) return "review";
    if (fixes < reviews) return "fix";
    const carried = ledger.round("fix", "task", { tasks: String(task) }, reviews);
    if (carried === null) return null;
    return router.next(EMPTY_RUN_STATE, carried)?.kind === "review" ? "review" : null;
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

  /** The line key of a fixed-target face — the ledger-round key (branch range / doc
   *  path — the lifecycle's own key derivation). */
  #lineKey(scene: WorkScene): string | null {
    if (scene.target?.kind === "branch")
      return `${scene.target.base.slice(0, 7)}..${scene.target.head.slice(0, 7)}`;
    if (scene.target?.kind === "doc") return scene.target.doc;
    return null;
  }

  /** The official handoff params of a line round (the lifecycle's own per-face shape). */
  #lineParams(scene: WorkScene, round: number): HandoffParams {
    if (scene.target?.kind === "branch") {
      const { base, head } = scene.target;
      return { base7: base.slice(0, 7), head7: head.slice(0, 7), round };
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
   *  — the brief's TASK_BASE rides the current git HEAD. */
  #renderBrief(scene: WorkScene, parsed: ParsedCommand): string {
    const tasks = this.#tasksOf(parsed);
    const content = this.#brief.render(scene.planText!, tasks, scene.head ?? "");
    const briefPath = scene.workspace.resolve(`tasks-${parsed.args.tasks}-brief.md`);
    writeFileSync(briefPath, content, "utf8");
    return briefPath;
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
      case "task": {
        if (planPath === null)
          throw new CliUsageError(
            `cdd ${verb} --type task: missing required --plan <path>`,
            CLI_USAGE[verb],
          );
        slug = Workspace.slugFromDoc(planPath);
        planText = this.#readText(planPath);
        break;
      }
      case "spec": {
        if (specPath === null)
          throw new CliUsageError(
            `cdd ${verb} --type spec: missing required --spec <path>`,
            CLI_USAGE[verb],
          );
        slug = Workspace.slugFromDoc(specPath);
        target = { kind: "doc", doc: specPath };
        break;
      }
      case "plan": {
        if (planPath === null)
          throw new CliUsageError(
            `cdd ${verb} --type plan: missing required --plan <path>`,
            CLI_USAGE[verb],
          );
        slug = Workspace.slugFromDoc(planPath);
        planText = this.#readText(planPath);
        target = { kind: "doc", doc: planPath };
        break;
      }
      case "branch": {
        const base = parsed.args.base;
        const head = parsed.args.head;
        if (base === undefined || head === undefined) {
          throw new CliUsageError(
            `cdd ${verb} --type branch: missing required --base <sha> --head <sha>`,
            CLI_USAGE[verb],
          );
        }
        slug =
          planPath !== null
            ? Workspace.slugFromDoc(planPath)
            : `${base.slice(0, 7)}..${head.slice(0, 7)}`;
        target = { kind: "branch", base, head };
        break;
      }
    }

    const workspace = new Workspace(root, slug).ensure();
    const ledger = new Ledger(workspace, config);
    const state =
      type === "task"
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

  /** `cdd schema get <type>` — the derived doc-structure schema JSON to stdout (the
   *  type vocabulary = the projector's registry keys — self-derived, never a second
   *  hand-written list). */
  #runSchema(parsed: ParsedCommand): number {
    const type = parsed.positionals[0];
    if (type === undefined)
      throw new CliUsageError("cdd schema get: missing <type>", CLI_USAGE.schema);
    this.#io.stdout(`${JSON.stringify(this.#projector.schema()[type as DocKey], null, 2)}\n`);
    return 0;
  }

  /** `cdd issue render` — stdin findings JSON → the aggregate body → stdout (the
   *  renderer's only CLI entry; a bare call, no flags). */
  #runIssue(parsed: ParsedCommand): number {
    void parsed;
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
        CLI_USAGE.base,
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
    if (parsed.leaf === "set") return this.#baseSet(parsed, workspace, planPath, path);
    if (parsed.leaf === "get") return this.#baseGet(path);
    throw new CliUsageError("cdd base: missing <set|get> subcommand", CLI_USAGE.base);
  }

  /** The `set` body — base/source required, a different existing base refuses without
   *  --force (the write-through artifact single-author). */
  #baseSet(parsed: ParsedCommand, workspace: Workspace, planPath: string, path: string): number {
    const base = parsed.args.base;
    const source = parsed.args.source;
    if (base === undefined || source === undefined) {
      throw new CliUsageError(
        "cdd base set: required --base <branch> and --source <source>",
        CLI_USAGE.base,
      );
    }
    const existing = this.#readBase(path);
    if (existing !== null && existing.base !== base && parsed.args.force !== "true") {
      throw new CliUsageError(
        `cdd base set: base already set to ${existing.base} — pass --force to override`,
        CLI_USAGE.base,
      );
    }
    const artifact: BaseArtifact = {
      base,
      source,
      plan: planPath,
      recordedAt: new Date().toISOString(),
    };
    void workspace;
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

  // ---------------------------------------------------------------------------
  // the shared parse primitives
  // ---------------------------------------------------------------------------

  /** The engine-config argv channel as the key → flag/type/values table. */
  #channelTable(): Record<string, ChannelArg> {
    const out: Record<string, ChannelArg> = {};
    const argv = this.#config.engineConfig().contextContract?.channels?.argv;
    if (argv === undefined) return out;
    for (const [key, entry] of Object.entries(argv)) {
      const row = entry as { flag?: string; type?: string; values?: readonly string[] };
      out[key] = {
        key,
        flag: row.flag ?? `--${key}`,
        type: (row.type as ChannelValueType) ?? "string",
        values: row.values,
      };
    }
    return out;
  }

  /** The normalized flag name of a token (`--tasks=1` → `tasks`). */
  #flagName(token: string): string {
    return token.replace(/^-{1,2}/, "").split("=")[0]!;
  }

  /** Resolve a normalized flag to its declared channel key (with the bool `--no-…`
   *  negation spelling); null = the flag is not declared → the unknown-option guard. */
  #declaredKey(surface: CliCommandSpec | CliLeafSpec, norm: string): string | null {
    if (norm.startsWith("no-")) {
      const key = norm.slice(3);
      return this.#channels[key]?.type === "bool" ? key : null;
    }
    for (const declared of surface.keys) {
      const channel = this.#channels[declared.key];
      if (channel !== undefined && channel.flag.replace(/^-{1,2}/, "") === norm)
        return declared.key;
    }
    return null;
  }

  /** Component-value validation — the channel type's shape (with the declared
   *  value-type override); a violation is the usage error of the command's surface. */
  #validate(
    spec: CliCommandSpec,
    surface: CliCommandSpec | CliLeafSpec,
    key: string,
    channel: ChannelArg,
    value: string,
  ): string {
    const override = (surface.keys as readonly CliArgSpec[]).find(
      (declared) => declared.key === key,
    )?.valueType;
    const type = override === "branch" ? "string" : channel.type;
    switch (type) {
      case "int-list": {
        const tokens = value.split(",").map((part) => part.trim());
        const invalid = tokens.find((part) => !/^\d+$/.test(part));
        if (invalid !== undefined) {
          throw this.#usage(
            `cdd ${spec.name}: --${key} must be comma-separated integers: ${invalid}`,
            surface.usage,
          );
        }
        return [...new Set(tokens.map(Number))].sort((a, b) => a - b).join(",");
      }
      case "enum":
        if (channel.values === undefined || !channel.values.includes(value)) {
          throw this.#usage(
            `cdd ${spec.name}: --${key} must be one of ${channel.values?.join(" | ")}`,
            surface.usage,
          );
        }
        return value;
      case "sha":
        if (!/^[0-9a-f]{40}$/.test(value)) {
          throw this.#usage(`cdd ${spec.name}: --${key} must be a 40-char sha`, surface.usage);
        }
        return value;
      case "int":
        if (!/^\d+$/.test(value))
          throw this.#usage(`cdd ${spec.name}: --${key} must be an integer`, surface.usage);
        return value;
      case "bool":
        // the value already carries the parsed spelling ("true" for --force · "false"
        // for --no-force) — pass it through, never force the positive.
        return value;
      case "path":
      case "string":
        return value;
    }
  }

  /** The declared positional values, validated (schema get's <type> = the derived
   *  registry key vocabulary — the projector's self-derived list). */
  #positionalsOf(surface: CliCommandSpec | CliLeafSpec, positionals: readonly string[]): string[] {
    const declared = surface.positionals ?? [];
    return declared.map((positional, index) => {
      const value = positionals[index];
      if (positional.key === "type" && !this.#docKeys.includes(value!)) {
        throw this.#usage(
          `cdd schema get: unknown schema type: ${value} (available: ${this.#docKeys.join(", ")})`,
          surface.usage,
        );
      }
      return value!;
    });
  }

  /** The usage-error constructor shorthand (the command's usage line rides the error). */
  #usage(message: string, usage: string): CliUsageError {
    return new CliUsageError(message, usage);
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
