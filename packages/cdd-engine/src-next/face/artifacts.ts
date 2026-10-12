// packages/cdd-engine/src-next/face/artifacts.ts
// T8 — the split contract's artifacts face (§6.2: face/artifacts.ts — the pure-command
// domain). The pure artifact surfaces run through this class: the schema skeleton
// (#runSchemaGen/#today), the issue render (#runIssue) and the base artifact
// read/write (#baseSet/#baseGet/#readBase) plus the doc read/usage face (#readText).
// The method bodies are the pre-split Cli members moved verbatim — behavior bytes
// identical; the root Cli holds the artifacts instance and composes through it via its
// .action thin shells. The root's commander usage throw (#usage — the composition-
// root exit face, never re-implemented here) is injected as the usage seam; the BaseArtifact
// row (the CDD --plan target's read/write face) is declared here and re-exported by
// face/cli.ts so the public surface never drifts.

import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import type { Command } from "commander";
import { declaredRegistries } from "../contract/declare.ts";
import type { DocKey } from "../contract/project.ts";
import { Projector } from "../contract/project.ts";
import type { IssueBodyRenderer, IssueReportInput } from "../render/issue-body.ts";
import { SkeletonAssembler } from "../render/skeleton.ts";
import type { RunInput } from "./cli.ts";
import type { CliIo } from "./lifecycle.ts";

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

/**
 * CliArtifacts — the pure-command domain (the split contract's artifacts face): the
 * schema/issue/base run bodies. The instance holds the pure-domain renderers + the
 * root-injected seam faces (io / the usage throw); the root composes the command
 * scenes and delegates the pure runs here.
 */
export class CliArtifacts {
  readonly #io: CliIo;
  readonly #projector: Projector;
  readonly #issue: IssueBodyRenderer;
  readonly #stdinRead: () => string;
  /** The composition-root usage throw — commander's OWN CommanderError (the root's
   *  exit-normalization face; the split never re-implements the usage byte). */
  readonly #usage: (node: Command, message: string) => never;

  constructor(opts: {
    io?: CliIo;
    projector?: Projector;
    issue: IssueBodyRenderer;
    stdinRead: () => string;
    usage: (node: Command, message: string) => never;
  }) {
    this.#io = opts.io ?? {
      stdout: (t) => process.stdout.write(t),
      stderr: (t) => process.stderr.write(t),
    };
    this.#projector = opts.projector ?? new Projector(declaredRegistries);
    this.#issue = opts.issue;
    this.#stdinRead = opts.stdinRead;
    this.#usage = opts.usage;
  }

  /** `cdd schema gen <type>` — the derived doc skeleton to stdout (the pure-render
   *  discovery read of the schema verb's second leaf): the normalized DocType key →
   *  the projector's skeleton projection → the SkeletonAssembler bytes → the single
   *  appended newline (the assembler never appends one — the redirected fixture
   *  ends with exactly one `\n`). Zero write side-effects — the orchestrator
   *  redirects the stdout to the target path. */
  runSchemaGen(node: Command, parsed: RunInput): number {
    const type = parsed.positionals[0];
    if (type === undefined) this.#usage(node, "cdd schema gen: missing <type>");
    const projection = this.#projector.skeleton()[type as DocKey];
    const date = this.#today();
    this.#io.stdout(`${new SkeletonAssembler(projection, date).render()}\n`);
    return 0;
  }

  /** `cdd issue render` — stdin findings JSON → the aggregate body → stdout (the
   *  renderer's only CLI entry; a bare call, no flags). */
  runIssue(): number {
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

  /** The `set` body — base/source required, a different existing base refuses without
   *  --force (the write-through artifact single-author). */
  baseSet(node: Command, parsed: RunInput, planPath: string, path: string): number {
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
  baseGet(path: string): number {
    const artifact = this.#readBase(path);
    if (artifact === null) {
      this.#io.stderr(`cdd base get: missing or corrupt base artifact at ${path}\n`);
      return 2;
    }
    this.#io.stdout(`${JSON.stringify(artifact, null, 2)}\n`);
    return 0;
  }

  /** Read a text file through the caller's command face; a missing/unreadable file is
   *  the usage error of that face (the owning node's commander-native usage line). */
  readText(node: Command, file: string): string {
    try {
      return readFileSync(file, "utf8");
    } catch {
      this.#usage(node, `cannot read file: ${file}`);
    }
  }

  /** The run date in `YYYY-MM-DD` — the skeleton's version-row date truth (the
   *  local day; the skeleton carries no date parameter face). */
  #today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
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
}
