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

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** The repo-scoped workspace base — `<repoRoot>/<workspaceRoot>`. */
export class WorkspaceRoot {
  readonly repoRoot: string;
  readonly path: string;

  constructor(repoRoot: string, workspaceRoot: string) {
    this.repoRoot = repoRoot;
    this.path = path.join(repoRoot, workspaceRoot);
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
