// packages/cdd-engine/src-next/infra/git.ts
// T12 — GitClient: the new tree's single git seam. Every git operation is an
// instance method (a stateless adapter over simple-git); operations are fail-open
// — a non-repo or git error yields null (string ops) / false (boolean ops) / an
// empty list (list ops), never a thrown exception across the seam.

import { simpleGit } from "simple-git";

/** One commit of a `git log` read. */
export interface GitLogEntry {
  hash: string;
  message: string;
  date: string;
}

/** GitClient — the engine's git judgment adapter. Stateless: construction is cheap,
 *  collaborators that need git are constructor-injected. */
export class GitClient {
  #git(cwd: string) {
    return simpleGit({ baseDir: cwd });
  }

  /** The repo root, mirroring `git rev-parse --show-toplevel`; null outside a repo. */
  async topLevel(cwd: string): Promise<string | null> {
    try {
      return (await this.#git(cwd).revparse(["--show-toplevel"])).trim() || null;
    } catch {
      return null;
    }
  }

  /** The full 40-char HEAD sha, mirroring `git rev-parse HEAD`; null outside a repo. */
  async revParseHead(cwd: string): Promise<string | null> {
    try {
      return (await this.#git(cwd).revparse(["HEAD"])).trim() || null;
    } catch {
      return null;
    }
  }

  /** Whether the working tree is clean (`git status --porcelain` = ""), optionally
   *  ignoring every path under one repo-relative directory — the clean-tree gate
   *  excludes the engine's own workspace (its run artifacts are engine-owned, never
   *  "uncommitted user work"). `--untracked-files=all` keeps untracked files
   *  individual so the path-based ignore sees them (a collapsed `?? <dir>/` entry
   *  would hide the workspace's path from the filter). */
  async isClean(cwd: string, ignorePath?: string): Promise<boolean> {
    try {
      const status = await this.#git(cwd).status({ "--untracked-files=all": null });
      if (ignorePath === undefined) return status.isClean();
      // A file under the workspace root is the engine's own; any other file is
      // uncommitted user work — every entry must be engine-owned for the tree to
      // qualify as clean.
      return status.files.every((file) => file.path.startsWith(`${ignorePath}/`));
    } catch {
      return false;
    }
  }

  /** Stage every tracked + untracked change (`git add -A`); false on error. */
  async addAll(cwd: string): Promise<boolean> {
    try {
      await this.#git(cwd).raw(["add", "-A"]);
      return true;
    } catch {
      return false;
    }
  }

  /** Stage everything and commit — returns the new HEAD sha, null on error. */
  async commit(cwd: string, message: string): Promise<string | null> {
    try {
      const git = this.#git(cwd);
      await git.raw(["add", "-A"]);
      await git.commit(message);
      return (await git.revparse(["HEAD"])).trim() || null;
    } catch {
      return null;
    }
  }

  /** The recent commit log, newest first — null on error. */
  async log(cwd: string, maxCount = 20): Promise<GitLogEntry[] | null> {
    try {
      const result = await this.#git(cwd).log({ maxCount });
      return result.all.map((entry) => ({
        hash: entry.hash,
        message: entry.message,
        date: entry.date,
      }));
    } catch {
      return null;
    }
  }
}
