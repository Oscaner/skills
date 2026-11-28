// packages/cdd-engine/src/env/workspace/workspace.ts
// The workspace plane: the repo-scoped root, one dispatch workspace, and the ONLY
// places in `src/**` that write to disk.
//
//   WorkspaceRoot — `<repoRoot>/<segment>` (one dispatch family's home). `ensure`
//     creates the root and publishes the namespace keep-out marker (`.kairos/.gitignore`
//     with a single `*`), so the engine's run artifacts are engine-owned and a consumer
//     repo stays clean across dispatches without adding an ignore rule of its own. The
//     ignore affects untracked files only — a user who git-tracks the workspace keeps
//     seeing its changes.
//   Workspace     — one dispatch workspace (`<base>/<slug>/`), with the two TEXT write
//     faces the whole engine is allowed to use and the one text READ face:
//       · writeText(name, text)      — WORKSPACE basis: the dispatched brief, which the
//                                      engine writes and the child reads inside the same
//                                      workspace. Returns its repo-relative path, because
//                                      the dispatch face prints exactly that value into
//                                      `INPUT_WAVE_BRIEF`.
//       · writeTextAt(target, text)  — REPO basis: the skeleton landing and material
//                                      writes, whose targets are already repo-relative.
//                                      Two bases, two faces, and no reuse across them: a
//                                      brief spelled repo-relative prints a path the child
//                                      cannot read and leaves an untracked file behind; a
//                                      skeleton spelled workspace-relative writes nothing
//                                      while echoing a path nobody wrote.
//       · readText(target)           — REPO basis, the one material read entry, so
//                                      `docs/**` carries zero `node:fs`.
//     A failed read or write is a DECLARED value, never a throw and never an empty
//     string; the wording of the consumer's byte belongs to the render face.
//
// Every write rides `Atomic` (temp sibling + rename). The `FileOps` implementation
// below is the engine's one syscall layout; `writeFileSync` appears in this file and
// nowhere else in `src/**`.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RepoPath, RepoRoot } from "../paths/root.ts";
import { Atomic, type FileOps } from "./atomic.ts";
import { BaseArtifact, type BaseHome, type JsonRead } from "./base-artifact.ts";
import { RoundLogLayout } from "./round-log.ts";
import { Seal } from "./seal.ts";

/** A text write's outcome: the repo-relative path it landed at, or the same path with
 *  the failure declared. The wording of any consumer byte belongs to `surface/`. */
export type WriteOutcome =
  | { readonly kind: "written"; readonly target: RepoPath }
  | { readonly kind: "write-failure"; readonly target: RepoPath };

/** A text read's outcome: the bytes, or the declared failure carrying the path that
 *  was asked for. A missing file is never an empty document. */
export type TextRead =
  | { readonly kind: "text"; readonly target: RepoPath; readonly value: string }
  | { readonly kind: "read-failure"; readonly target: RepoPath };

/** The node-backed syscall layout — the engine's ONE `FileOps` implementation. */
export class NodeFileOps implements FileOps {
  write(file: string, text: string): void {
    writeFileSync(file, text, "utf8");
  }

  rename(from: string, to: string): void {
    renameSync(from, to);
  }

  remove(file: string): void {
    rmSync(file, { force: true });
  }

  exists(file: string): boolean {
    return existsSync(file);
  }
}

/** The repo-scoped workspace base — `<repoRoot>/<segment>`. */
export class WorkspaceRoot {
  /** The workspace's repo-relative segment (`.kairos/cdd` under the default config) —
   *  the ONE spelling of the family's home. */
  static readonly DEFAULT_SEGMENT = ".kairos/cdd";

  /** The keep-out marker's file name inside the namespace root. */
  static readonly IGNORE_FILE = ".gitignore";

  /** The keep-out marker's whole content — the entire namespace is engine-owned. */
  static readonly IGNORE_CONTENT = "*\n";

  /** The path basis every child spelling is taken against. */
  readonly basis: RepoRoot;

  /** The clock this family's artifacts timestamp through — injected, never defaulted. */
  readonly now: () => number;

  /** The base artifact's file name — the artifact matrix's derived spelling. */
  readonly baseName: string;

  /** The syscall layout one workspace family writes through. */
  readonly ops: FileOps;

  /** The root's repo-relative path. */
  readonly rel: RepoPath;

  /** The root's absolute path. */
  readonly path: string;

  readonly #atomic: Atomic;

  constructor(opts: {
    basis: RepoRoot;
    now: () => number;
    baseName: string;
    segment?: string;
    ops?: FileOps;
  }) {
    if (typeof opts.now !== "function") {
      throw new Error("WorkspaceRoot: `now` is required (no default clock)");
    }
    if (typeof opts.baseName !== "string" || opts.baseName.length === 0) {
      throw new Error("WorkspaceRoot: `baseName` is required (no default file name)");
    }
    this.basis = opts.basis;
    this.rel = opts.basis.relativize(opts.segment ?? WorkspaceRoot.DEFAULT_SEGMENT);
    this.path = opts.basis.resolve(this.rel);
    this.now = opts.now;
    this.baseName = opts.baseName;
    this.ops = opts.ops ?? new NodeFileOps();
    this.#atomic = new Atomic(this.ops);
  }

  /** The workspace of one dispatch slug — the family's ONE construction entry. */
  at(slug: string): Workspace {
    return new Workspace({ root: this, slug });
  }

  /** Idempotently create the root and publish the namespace keep-out marker. Nothing
   *  below the root is created: a workspace appears when a dispatch writes into it, so
   *  a read-only command leaves no slug directory behind. */
  ensure(): WorkspaceRoot {
    mkdirSync(this.path, { recursive: true });
    const namespace = path.dirname(this.path);
    mkdirSync(namespace, { recursive: true });
    const marker = path.join(namespace, WorkspaceRoot.IGNORE_FILE);
    if (!existsSync(marker)) {
      this.#atomic.write(marker, WorkspaceRoot.IGNORE_CONTENT);
    }
    return this;
  }
}

/** One dispatch workspace — `<base>/<slug>/`. */
export class Workspace implements BaseHome {
  /** The workspace's round-log names live here (the layout's own segment). */
  static readonly LOGS_SEGMENT = RoundLogLayout.SEGMENT;

  readonly root: WorkspaceRoot;
  readonly slug: string;
  readonly path: string;
  readonly #atomic: Atomic;

  constructor(opts: { root: WorkspaceRoot; slug: string }) {
    this.root = opts.root;
    this.slug = opts.slug;
    this.path = path.join(opts.root.path, opts.slug);
    this.#atomic = new Atomic(opts.root.ops);
  }

  /** Idempotently create the root and this workspace's directory. */
  ensure(): Workspace {
    this.root.ensure();
    mkdirSync(this.path, { recursive: true });
    return this;
  }

  /** One child's absolute path. */
  resolve(name: string): string {
    return path.join(this.path, name);
  }

  /** One child's repo-relative path. */
  relOf(name: string): RepoPath {
    return this.root.basis.relativize(this.resolve(name));
  }

  /** Read a JSON child — the tri-state face, so a never-written child and a corrupt
   *  one stay different facts. */
  readJson(name: string): JsonRead<unknown> {
    let text: string;
    try {
      text = readFileSync(this.resolve(name), "utf8");
    } catch (raw) {
      const code = (raw as NodeJS.ErrnoException).code;
      return code === "ENOENT" ? { kind: "missing" } : { kind: "malformed" };
    }
    try {
      return { kind: "ok", value: JSON.parse(text) };
    } catch {
      return { kind: "malformed" };
    }
  }

  /** Write a JSON child atomically; a killed process leaves the previous whole
   *  document. The bytes end with exactly one `\n` (the repo's EOF rule), so an
   *  engine-written artifact is byte-canonical. */
  writeJson(name: string, value: unknown): RepoPath {
    this.ensure();
    this.#atomic.write(this.resolve(name), `${JSON.stringify(value, null, 2)}\n`);
    return this.relOf(name);
  }

  /** Write a text child on the WORKSPACE basis — the dispatched brief. Returns the
   *  repo-relative path it landed at; a failure is declared, never thrown. */
  writeText(name: string, text: string): WriteOutcome {
    const target = this.relOf(name);
    try {
      this.ensure();
      this.#atomic.write(this.resolve(name), text);
    } catch {
      return { kind: "write-failure", target };
    }
    return { kind: "written", target };
  }

  /** Write a text file on the REPO basis — the skeleton landing and material writes.
   *  The absolute path is spelled through `RepoRoot#resolve`, the one erasure point. */
  writeTextAt(target: RepoPath, text: string): WriteOutcome {
    try {
      const absolute = this.root.basis.resolve(target);
      mkdirSync(path.dirname(absolute), { recursive: true });
      this.#atomic.write(absolute, text);
    } catch {
      return { kind: "write-failure", target };
    }
    return { kind: "written", target };
  }

  /** Read a text file on the REPO basis — the one material read entry. A missing or
   *  unreadable target is a declared failure carrying the asked-for path. */
  readText(target: RepoPath): TextRead {
    try {
      return {
        kind: "text",
        target,
        value: readFileSync(this.root.basis.resolve(target), "utf8"),
      };
    } catch {
      return { kind: "read-failure", target };
    }
  }

  /** One round's log coordinate (created lazily with its directory). */
  roundLogOf(name: string): RepoPath {
    return new RoundLogLayout(this.path, this.root.basis).pathOf(name);
  }

  /** The permission-bit face of one workspace child. Which names are carriers is the
   *  artifact matrix's judgment; this answers the bit for a name it was given. */
  sealOf(name: string): Seal {
    return new Seal(this.resolve(name));
  }

  /** This workspace's base artifact, over the injected clock and file name. */
  baseOf(): BaseArtifact {
    return new BaseArtifact({
      home: this,
      now: this.root.now,
      baseName: this.root.baseName,
    });
  }
}
