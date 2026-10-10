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

  /** The HEAD sha in the engine's 8-char short form, mirroring `git rev-parse
   *  --short=8 HEAD` (find #10 · spec §6.6 — 40-char full shas retired); null
   *  outside a repo. */
  async revParseHead(cwd: string): Promise<string | null> {
    try {
      return (await this.#git(cwd).revparse(["--short=8", "HEAD"])).trim() || null;
    } catch {
      return null;
    }
  }

  /** Whether the working tree is clean — `git status --porcelain` = "" (the
   *  clean-tree gate reads git's own judgment, zero engine-side exclusion: the
   *  engine's workspace self-publishes its `.gitignore` (content `*`) at ensure
   *  time, so its run artifacts never read as uncommitted user work — the gate
   *  refuses only genuinely dirty USER changes). Fail-open-false (a non-repo
   *  counts dirty — the CDD flow needs git). */
  async isClean(cwd: string): Promise<boolean> {
    try {
      return (await this.#git(cwd).status()).isClean();
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

  /** Stage everything and commit — returns the new HEAD sha in the engine's 8-char
   *  short form (find #10 · spec §6.6 — long shas retired), null on error. */
  async commit(cwd: string, message: string): Promise<string | null> {
    try {
      const git = this.#git(cwd);
      await git.raw(["add", "-A"]);
      await git.commit(message);
      return (await git.revparse(["--short=8", "HEAD"])).trim() || null;
    } catch {
      return null;
    }
  }

  /** The recent commit log, newest first — the 8-char short hashes (find #10) —
   *  null on error. */
  async log(cwd: string, maxCount = 20): Promise<GitLogEntry[] | null> {
    try {
      const result = await this.#git(cwd).log({ maxCount });
      return result.all.map((entry) => ({
        hash: entry.hash.slice(0, 8),
        message: entry.message,
        date: entry.date,
      }));
    } catch {
      return null;
    }
  }
}
