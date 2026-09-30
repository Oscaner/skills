// packages/cdd-engine/src/infra/workspace.ts — the engine workspace data plane (T6 consolidation): the
// WorkspaceRoot + Workspace class pair owns every on-disk workspace concern formerly scattered
// across naming.ts / resolveWorkspace / materializeWorkspace / the six scattered mkdirSync sites.
//   WorkspaceRoot — the repo-scoped workspace base (`<repoRoot>/<workspaceRoot>`, the segment value
//     from engine-config.json#handoffNamespace.workspaceRoot — the single source; zero hard-coded
//     literals). from(repoRoot, config) self-derives it (the ConfigLoader namespace single source,
//     same derivation the ConfigLoader consumers use — no new constructor injection surface);
//     for(doc) is the UNIQUE doc → slug derivation entry (replaces the resolveWorkspace pure
//     function; the -design/-plan single-layer strip rule lives here); enumerate() reads the base
//     subdirectories (the reapStale full-scan target).
//   Workspace — one dispatch workspace (`<workspaceRoot>/<slug>/`): ensure() mkdirs the slug dir
//     (the single directory-creation point every workspace write routes through — the mkdir sites
//     formerly scattered across base-branch / handoff-write / naming / runtime / branch / task all
//     converge here); readJson/writeJson are the atomic JSON read/write pair (mkdir before write)
//     progress / handoff / base-branch converge onto them; progressPath / briefPath / lifecyclePath
//     are the child-path single facts. The path-only construction form (fromPath) wraps a raw
//     workspace DIRECTORY for tests and the rules-layer string contexts — the slug-derived shape
//     stays the canonical construction, the path-only form carries no derivation.
//
// OOP Criterion ②: everything is an instance/static method — zero bare function exports.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "tinyglobby";
import type { EngineConfig } from "./config.ts";
import { ConfigLoader } from "./config.ts";
import { CddExitError } from "./exit.ts";

/** slugRule: reviewed doc file name minus `.md` → single-layer strip of a trailing `-design` or
 * `-plan` (anchored, mutually exclusive, naturally non-cascading). spec/plan (-design.md / -plan.md
 * / no suffix) converge to the same value; depends only on the file name, not existence. */
function slugFromDoc(doc: string): string {
  const base = path.basename(doc).replace(/\.md$/, "");
  return base.replace(/-(?:design|plan)$/, "");
}

/** WorkspaceRoot — the repo-scoped workspace base (<repoRoot>/<workspaceRoot>); the namespace
 *  single-source derivation the workspace plane is built on. */
export class WorkspaceRoot {
  /** The git repo root this workspace base lives under. */
  readonly repoRoot: string;
  /** The canonical workspace-root segment (engine-config.json#handoffNamespace.workspaceRoot —
   *  `.osuperpowers/cdd`; zero consumer-literal duplication). */
  readonly workspaceRoot: string;
  /** The workspace base directory: `<repoRoot>/<workspaceRoot>`. */
  readonly path: string;
  /** The root-level bootstrap gitignore: `<repoRoot>/.osuperpowers/.gitignore` — self-guarding the
   *  whole workspace subtree without relying on the repo root .gitignore. */
  readonly gitignorePath: string;

  private constructor(repoRoot: string, config: EngineConfig["handoffNamespace"]) {
    this.repoRoot = repoRoot;
    this.workspaceRoot = config.workspaceRoot;
    this.path = path.join(repoRoot, config.workspaceRoot);
    this.gitignorePath = path.join(repoRoot, ".osuperpowers", ".gitignore");
  }

  /** from(repoRoot, config) — the single construction entry: repoRoot from the caller (the
   *  runtime/CLI root authority), config defaulting to the ConfigLoader namespace (its single
   *  source — no second read of engine-config.json). */
  static from(
    repoRoot: string,
    config: EngineConfig["handoffNamespace"] = new ConfigLoader().handoffNamespace(),
  ): WorkspaceRoot {
    return new WorkspaceRoot(repoRoot, config);
  }

  /** ensure() — idempotent bootstrap: create the workspace base directory + write the
   *  root-level `.gitignore` (`*\n`, self-guard — the workspace subtree never pollutes the tracked
   *  tree on a fresh repo's first cdd run, without depending on the repo root .gitignore). */
  ensure(): void {
    mkdirSync(this.path, { recursive: true });
    writeFileSync(this.gitignorePath, "*\n");
  }

  /** for(doc) — the UNIQUE doc → slug derivation entry (replaces resolveWorkspace /
   *  workspaceSlug): the doc file name converges to its workspace slug (-design/-plan single-layer
   *  strip), an undeferrable empty/`.`/`..` slug is rejected with the recoverable run-blocked face
   *  (the former materializeWorkspace guard). */
  for(doc: string): Workspace {
    const slug = slugFromDoc(doc);
    if (!slug || slug === "." || slug === "..") {
      throw new CddExitError(`cannot derive workspace name from: ${doc}`, {
        exitCode: 1,
        kind: "run-blocked",
      });
    }
    return new Workspace(this, slug);
  }

  /** enumerate() — the slug names of the workspace base subdirectories (the reapStale full-scan
   *  target; a missing base → no workspaces, never a throw). Uses the shared tinyglobby glob
   *  toolchain (the same `*` scan the handoff round walk uses) — no hand-written directory walk. */
  enumerate(): string[] {
    let names: string[];
    try {
      names = globSync("*", { cwd: this.path, onlyDirectories: true, dot: true });
    } catch {
      return [];
    }
    // tinyglobby marks directories with a trailing slash — the slug names are the bare entry names.
    return names.map((n) => n.replace(/[\\/]$/, ""));
  }
}

/** Workspace — one dispatch workspace (`<workspaceRoot>/<slug>/`): the directory/JSON write single
 *  point + the child-path single facts. Public constructor `(workspaceRoot, slug)`; the canonical
 *  construction is `WorkspaceRoot#for` / `#enumerate`; `fromPath(dir)` wraps a raw workspace
 *  DIRECTORY (tests / the rules-layer string contexts), yielding a path-only Workspace. */
export class Workspace {
  /** The owning workspace base; null on the path-only (fromPath) form. */
  readonly workspaceRoot: WorkspaceRoot | null;
  /** The workspace slug (the subdirectory name under the workspace base); on the path-only form
   *  this holds the whole raw directory. */
  readonly slug: string;

  constructor(workspaceRoot: WorkspaceRoot | null, slug: string) {
    this.workspaceRoot = workspaceRoot;
    this.slug = slug;
  }

  /** fromPath(dir) — path-only form: a Workspace whose directory IS dir (no root+slug derivation).
   *  For tests and the rules-layer consumers that carry a concrete workspace directory. */
  static fromPath(dir: string): Workspace {
    return new Workspace(null, dir);
  }

  /** The workspace directory: `<workspaceRoot>/<slug>` (identity on the path-only form). */
  get path(): string {
    return this.workspaceRoot ? path.join(this.workspaceRoot.path, this.slug) : this.slug;
  }

  /** ensure() — the single directory-creation point: mkdir the workspace dir `{ recursive: true }`
   *  before any write (the six scattered mkdirSync sites converge here). */
  ensure(): void {
    mkdirSync(this.path, { recursive: true });
  }

  /** The progress ledger file's canonical path (progress.json). */
  get progressPath(): string {
    return path.join(this.path, "progress.json");
  }

  /** briefPath(tasks) — the group-keyed task brief's canonical path
   *  (`tasks-<groupKey>-brief.md`; the group key IS the dispatch unit's serialization). */
  briefPath(tasks: string): string {
    return path.join(this.path, `tasks-${tasks}-brief.md`);
  }

  /** The process-lifecycle registry file's canonical path (lifecycle.json, T6 relocation: per-slug, never
   *  the repo-level single file). */
  get lifecyclePath(): string {
    return path.join(this.path, "lifecycle.json");
  }

  /** readJson<T>(name) — atomic JSON read ("><workspace>/<name>`; missing/corrupt → null,
   *  fail-open). progress / handoff / base-branch converge here. */
  readJson<T = Record<string, unknown>>(name: string): T | null {
    try {
      return JSON.parse(readFileSync(path.join(this.path, name), "utf8")) as T;
    } catch {
      return null;
    }
  }

  /** writeJson(name, data) — atomic JSON write: ensure the workspace dir, then stringify +
   *  writeFileSync. progress / handoff / base-branch converge here. */
  writeJson(name: string, data: unknown): void {
    this.ensure();
    writeFileSync(path.join(this.path, name), `${JSON.stringify(data, null, 2)}\n`);
  }
}
