// packages/cdd-engine/src-next/infra/git.ts
// T12 — GitClient: the new tree's single git seam. It holds exactly the two
// judgments the engine's git face needs — where the repo root is (topLevel) and
// whether the working tree is clean (isClean). Operations are fail-open — a
// non-repo or git error yields null (topLevel) / false (isClean), never a thrown
// exception across the seam.

import { simpleGit } from "simple-git";

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

  /** The current HEAD sha — the dispatch's baseline for the crash record's
   *  `dispatchBase`. null outside a repo or on a branch with no commit yet (a
   *  present fact only, never a fabricated ref). */
  async head(cwd: string): Promise<string | null> {
    try {
      return (await this.#git(cwd).revparse(["HEAD"])).trim() || null;
    } catch {
      return null;
    }
  }

  /** The commits added after `base`, oldest first, each as `{sha} {subject}` — the
   *  work a crashed child left behind. An absent base or an unreadable repo yields
   *  the empty list (fail-open: the diagnostic fact never breaks a crash record). */
  async commitsSince(cwd: string, base: string | null): Promise<readonly string[]> {
    if (base === null) return [];
    try {
      const log = await this.#git(cwd).log({ from: base, to: "HEAD" });
      return log.all.map((entry) => `${entry.hash} ${entry.message}`);
    } catch {
      return [];
    }
  }
}
