// packages/cdd-engine/src-next/face/artifacts.ts
// T8 — the split contract's artifacts face (§6.2: face/artifacts.ts — the pure-command
// domain). The pure artifact surfaces run through this class: the schema skeleton
// (#runSchemaSkeleton/#today), the issue render (#runIssue) and the base artifact
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
import type { RepoPath, RepoRoot } from "../infra/root.ts";
import type { Workspace } from "../infra/workspace.ts";
import type { IssueBodyRenderer, IssueReportInput } from "../render/issue-body.ts";
import { SkeletonAssembler } from "../render/skeleton.ts";
import type { RunInput } from "./cli.ts";
import { ARGV_CHANNEL } from "./declare.ts";
import type { CliIo } from "./lifecycle.ts";

// ---------------------------------------------------------------------------
// the pure artifact surfaces — the base artifact + the issue body
// ---------------------------------------------------------------------------

/** The base's source value domain — the four-value enum (design spec §3.2 ⑪).
 *  Derived from the ONE declaration (the argv channel's `--source` domain,
 *  face/declare.ts:76), so the artifact's `source` field and the CLI's accepted
 *  values can never drift. */
export type BaseSource = (typeof ARGV_CHANNEL.source.values)[number];

/** The base artifact's declared field set, in canonical order — the runtime
 *  companion of `BaseArtifact` (the `base.md` documented schema's four fields,
 *  spec §3.2 ⑪). The cross-face gate (kairos suite) pins the `base.md` schema
 *  table's field set to THIS tuple, so the doc and the artifact can never drift. */
export const BASE_ARTIFACT_FIELDS = ["base", "source", "plan", "recordedAt"] as const;

/** The base artifact schema — the sole CDD --plan target's read/write row (the
 *  artifact file carries the `base` face: the base branch the plan's line rides).
 *  The field set (`base`/`source`/`plan`/`recordedAt`) mirrors the `base.md`
 *  documented schema (spec §3.2 ⑪); `source` is narrowed to the declared enum
 *  `BaseSource` — never a bare `string` (the drifted face this gate closes). */
export interface BaseArtifact {
  /** The base branch name. */
  base: string;
  /** The base's source channel (the declared `--source` enum). */
  source: BaseSource;
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

  /** `cdd schema get <type> --output skeleton <target>` — the derived doc skeleton
   *  rendered DIRECTLY into the target document (the D19 merged leaf's skeleton
   *  face): the normalized DocType key → the projector's skeleton projection → the
   *  SkeletonAssembler bytes → the single appended newline written to <target>
   *  (the assembler never appends one — the written doc ends with exactly one
   *  `\n`). The target is the engine-declared parameter of the skeleton render
   *  face — the authoring scaffold lands in place, zero shell-redirection
   *  indirection (the D19 `<path>` zero-constraint fix). The echoed path is the
   *  repoRoot-relative shape (D47 · §2.13: the branded `RepoPath` param on both the
   *  stdout line and the failure byte; `RepoRoot.resolve` feeds only the writeFileSync
   *  syscall). */
  runSchemaSkeleton(node: Command, root: RepoRoot, type: string, target: RepoPath): number {
    const projection = this.#projector.skeleton()[type as DocKey];
    const date = this.#today();
    const file = `${new SkeletonAssembler(projection, date).render()}\n`;
    const absolute = root.resolve(target);
    try {
      writeFileSync(absolute, file, "utf8");
    } catch {
      this.#usage(node, `cannot write file: ${target}`);
    }
    this.#io.stdout(`${target}\n`);
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
   *  `--force` (the write-through artifact single-author). The write rides
   *  `Workspace.writeJson` (P11 · §4.2: the JSON write self-ensures, so `base set` on
   *  a fresh repo builds the workspace with no scene-side ensure); the read rides the
   *  same `Workspace.readJson` normalization path. The echoed path is the
   *  repoRoot-relative shape (D47 · the ONE basis), normalized through the threaded
   *  basis (F2). */
  baseSet(
    node: Command,
    parsed: RunInput,
    planPath: RepoPath,
    workspace: Workspace,
    root: RepoRoot,
  ): number {
    const base = parsed.args.base;
    const source = parsed.args.source;
    if (base === undefined || source === undefined) {
      this.#usage(node, "cdd base set: required --base <branch> and --source <source>");
    }
    const existing = this.#readBase(workspace);
    if (existing !== null && existing.base !== base && parsed.args.force !== "true") {
      this.#usage(
        node,
        `cdd base set: base already set to ${existing.base} — pass --force to override`,
      );
    }
    // The `--source` enum channel already validated the raw against the declared
    // domain, so the value is narrowed to BaseSource here (single source: the
    // channel's `values` array).
    const artifact: BaseArtifact = {
      base,
      source: source as BaseSource,
      plan: planPath,
      recordedAt: new Date().toISOString(),
    };
    workspace.writeJson("base.json", artifact);
    this.#io.stdout(`${root.relativize(workspace.resolve("base.json"))}\n`);
    return 0;
  }

  /** The `get` body — read + validate + print the artifact JSON (exit 2 when the
   *  artifact is missing or corrupt — the orchestrator's inference-chain input). A
   *  pure READ (P11 · §4.2): the workspace is never built here, so `cdd base get`
   *  leaves `.kairos/` absent on a fresh repo. The echoed path is the repoRoot-relative
   *  shape (D47), normalized through the threaded basis (F2). */
  baseGet(workspace: Workspace, root: RepoRoot): number {
    const artifact = this.#readBase(workspace);
    if (artifact === null) {
      const path = root.relativize(workspace.resolve("base.json"));
      this.#io.stderr(`cdd base get: missing or corrupt base artifact at ${path}\n`);
      return 2;
    }
    this.#io.stdout(`${JSON.stringify(artifact, null, 2)}\n`);
    return 0;
  }

  /** Read a text file through the caller's command face; a missing/unreadable file is
   *  the usage error of that face (the owning node's commander-native usage line). The
   *  path is a branded `RepoPath` (repoRoot-relative — T3 §2.3: a bare `string` never
   *  reaches this read) erased to the absolute syscall form through the ONE value
   *  object (`RepoRoot.resolve`), so the read reads the file the funnel named. The
   *  echoed path in the refusal byte is the repoRoot-relative shape (D47 · §2.13: the
   *  branded `RepoPath`; `RepoRoot.resolve` feeds only the readFileSync syscall). */
  readText(node: Command, root: RepoRoot, file: RepoPath): string {
    const absolute = root.resolve(file);
    try {
      return readFileSync(absolute, "utf8");
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

  /** Read + validate the base artifact; null when missing or malformed — a total
   *  read (never a throw). The read rides `Workspace.readJson` (P11 · §4.2) — the
   *  read/write single normalization path, so a legacy absolute `plan` field reads
   *  back in the canonical repoRoot-relative shape (the retired migration's job is the
   *  read-time backstop). A non-object JSON payload (the literal `null`, a bare
   *  scalar/array) is malformed input, not a base artifact. The `source` field is
   *  narrowed to the declared enum domain (a value outside the four-value set is a
   *  schema-invalid artifact → null, never a fabricated source). */
  #readBase(workspace: Workspace): BaseArtifact | null {
    const read = workspace.readJson<unknown>("base.json");
    if (read.kind !== "ok") return null;
    const parsed = read.value;
    if (parsed === null || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.base !== "string" ||
      typeof record.source !== "string" ||
      typeof record.plan !== "string"
    )
      return null;
    if (!(ARGV_CHANNEL.source.values as readonly string[]).includes(record.source)) return null;
    return {
      base: record.base,
      source: record.source as BaseSource,
      plan: record.plan,
      recordedAt: typeof record.recordedAt === "string" ? record.recordedAt : "",
    };
  }
}
