// packages/cdd-engine/src-next/infra/workspace.ts
// T12 — the workspace data plane: the WorkspaceRoot + Workspace pair owns every
// on-disk workspace concern of the new tree.
//   WorkspaceRoot — the repo-scoped workspace base (`<repoRoot>/<workspaceRoot>`,
//     one dispatch family's home; the segment single-sources the engine config's
//     handoffNamespace.workspaceRoot and is never a hard-coded literal).
//   Workspace     — one dispatch workspace (`<base>/<slug>/`): ensure() mkdirs the
//     slug dir, readJson/writeJson are the JSON read/write pair (mkdir before
//     write), resolve() is the child-path single fact, slugFromDoc is the doc-file
//     → slug derivation (`-design`/`-plan` suffix strip).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** The repo-scoped workspace base — `<repoRoot>/<workspaceRoot>`. */
export class WorkspaceRoot {
  readonly repoRoot: string;
  readonly path: string;

  constructor(repoRoot: string, workspaceRoot: string) {
    this.repoRoot = repoRoot;
    this.path = path.join(repoRoot, workspaceRoot);
  }

  /** Idempotently create the workspace root + self-publish the namespace root's
   *  `.gitignore` (a single `*` — everything under `.kairos/` is engine-owned, so
   *  the git face ignores the whole namespace wholesale, the `cdd/` workspace and
   *  any future sibling alike). The tree-clean gate then reads git's own judgment
   *  — `isClean` with zero engine-side exclusion — a consumer repo with no `.kairos`
   *  entry in its own `.gitignore` still stays clean across dispatches, because
   *  the workspace publishes its keep-out marker at ensure time, before the gate
   *  ever reads the tree (the F1 fix: the engine's run artifacts are engine-owned,
   *  never "uncommitted user work"). The ignore affects only untracked files — a
   *  user who git-tracks the workspace keeps seeing its changes on the gate. */
  ensure(): WorkspaceRoot {
    mkdirSync(this.path, { recursive: true });
    // The namespace root — the workspace root's parent (`.kairos/cdd` → `.kairos`):
    // the keep-out marker sits at the namespace's top, never per-workspace (the
    // consumer-facing convention: ignore the whole `.kairos` namespace at once).
    const namespaceRoot = path.dirname(this.path);
    mkdirSync(namespaceRoot, { recursive: true });
    const ignore = path.join(namespaceRoot, ".gitignore");
    if (!existsSync(ignore)) writeFileSync(ignore, "*\n", "utf8");
    return this;
  }
}

/** One dispatch workspace — `<base>/<slug>/`. */
export class Workspace {
  readonly root: WorkspaceRoot;
  readonly slug: string;
  readonly path: string;

  constructor(root: WorkspaceRoot, slug: string) {
    this.root = root;
    this.slug = slug;
    this.path = path.join(root.path, slug);
  }

  /** The doc-file → slug derivation: strip `.md`, then one trailing `-design` or
   *  `-plan` suffix (anchored, mutually exclusive — spec and plan converge). */
  static slugFromDoc(doc: string): string {
    const base = path.basename(doc).replace(/\.md$/, "");
    return base.replace(/-(?:design|plan)$/, "");
  }

  /** Idempotently create the workspace directory. */
  ensure(): Workspace {
    this.root.ensure();
    mkdirSync(this.path, { recursive: true });
    return this;
  }

  /** A child path inside this workspace. */
  resolve(name: string): string {
    return path.join(this.path, name);
  }

  /** Read a JSON child — null when unreadable (missing or malformed). */
  readJson<T>(name: string): T | null {
    try {
      return JSON.parse(readFileSync(this.resolve(name), "utf8")) as T;
    } catch {
      return null;
    }
  }

  /** Write a JSON child — mkdir before write. */
  writeJson(name: string, value: unknown): void {
    this.ensure();
    writeFileSync(this.resolve(name), JSON.stringify(value, null, 2), "utf8");
  }
}
