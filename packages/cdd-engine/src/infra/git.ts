// packages/cdd-engine/src/infra/git.ts — GitClient: the simple-git single-point domain service
// class (Task 7 OOP restructure; spec §2.13 git row + Criterion ② — every git operation is a method,
// zero bare function exports). New dependency point for ALL git operations in rebuilt infra:
// status / add / commit / head / log / toplevel / cat-file. Replaces the hand-written git
// subprocess helpers that used to live in rules/commit.mjs (whose callers were re-pointed by
// Task 5 — this is now the single git seam).
// Fail-open contracts mirror the old helpers exactly: non-repo or git error → null (string ops) /
// false (boolean ops); no exception crosses the seam.

import { simpleGit } from "simple-git";

export interface GitLogOptions {
  maxCount?: number;
}

export interface GitLogEntry {
  hash: string;
  message: string;
  date: string;
}

/** GitClient — the engine's single git judgment seam. Every operation is an instance method;
 *  the class is stateless (fail-open behavior rides the simple-git call, never instance state),
 *  so construction is cheap and collaborators that need git are constructor-injected.
 */
export class GitClient {
  #git(cwd: string) {
    return simpleGit({ baseDir: cwd });
  }

  /** repo root, mirroring `git rev-parse --show-toplevel` (old gitToplevel). */
  async topLevel(cwd: string): Promise<string | null> {
    try {
      return (await this.#git(cwd).revparse(["--show-toplevel"])).trim() || null;
    } catch {
      return null;
    }
  }

  /** HEAD sha, mirroring `git rev-parse HEAD` (old gitRevParseHead). */
  async revParseHead(cwd: string): Promise<string | null> {
    try {
      return (await this.#git(cwd).revparse(["HEAD"])).trim() || null;
    } catch {
      return null;
    }
  }

  /** `git status --porcelain` content; "" = clean tree (old gitStatusPorcelain). */
  async statusPorcelain(cwd: string): Promise<string | null> {
    try {
      return (await this.#git(cwd).raw(["status", "--porcelain"])).trim();
    } catch {
      return null;
    }
  }

  /** `git add <paths>`; false on error (fail-open). */
  async add(cwd: string, paths: string[]): Promise<boolean> {
    try {
      await this.#git(cwd).add(paths);
      return true;
    } catch {
      return false;
    }
  }

  /** `git add -A` — stage every tracked + untracked working-tree change (the crash-only snapshot's
   *  sweep; the engine's only two-step add-then-commit verb). false on error (fail-open). */
  async addAll(cwd: string): Promise<boolean> {
    try {
      await this.#git(cwd).raw(["add", "-A"]);
      return true;
    } catch {
      return false;
    }
  }

  /** `git commit -m <message>`; returns the new HEAD sha, null on error (fail-open). `noVerify`
   *  routes through `git commit --no-verify` — the ONLY justified hook bypass (T7): a crash-only
   *  snapshot commits a tree that may be a syntactically half-finished crash moment, which the
   *  pre-commit biome hook would reject. The snapshot is a recovery point, not an acceptance
   *  surface — the quality gates (biome via exit gate + review + merge) run on the resume, never
   *  on the snapshot itself. */
  async commit(cwd: string, message: string, noVerify = false): Promise<string | null> {
    try {
      if (noVerify) await this.#git(cwd).raw(["commit", "--no-verify", "-m", message]);
      else await this.#git(cwd).commit(message);
    } catch {
      return null;
    }
    return this.revParseHead(cwd);
  }

  /** `git log` entries newest-first (returns null on error/empty). Each entry carries
   * hash/message/date — the consumer-facing log contract of this single git point. */
  async log(cwd: string, opts: GitLogOptions = {}): Promise<GitLogEntry[] | null> {
    try {
      const res = await this.#git(cwd).log({ maxCount: opts.maxCount ?? 10 });
      return res.all.map((line) => ({ hash: line.hash, message: line.message, date: line.date }));
    } catch {
      return null;
    }
  }

  /** `git cat-file -e <sha>^{commit}` — true when sha is a real reachable commit (phantom-SHA guard). */
  async catFileCommitExists(cwd: string, sha: string | null | undefined): Promise<boolean> {
    if (!sha) return false;
    try {
      await this.#git(cwd).catFile(["-e", `${sha}^{commit}`]);
      return true;
    } catch {
      return false;
    }
  }

  /** `git merge-base <ancestor> <descendant>` result == ancestor ⟺ descendant can reach ancestor
   *  (the ancestry ground of the T26/T27 resume-declared base validation). Implemented through the
   *  merge-base OUTPUT, not `--is-ancestor`'s exit code: simple-git's `raw()` swallows non-zero
   *  exits (a `--is-ancestor` that returns 1 resolves like a success), while `merge-base` prints the
   *  LCA sha — and the LCA of A and B IS A itself exactly when A is an ancestor of B, decodable from
   *  the resolved stdout. Reflexive: an object is an ancestor of itself (merge-base(A,A) == A), so
   *  the caller must additionally require `!== HEAD` (that gate lives at the adoption lane). false on
   *  any error / stderr-failure / empty output — fail-open: an unknown/phantom/dangling sha (or a
   *  non-repo cwd) must never pass the adoption lane. */
  async mergeBaseIsAncestor(cwd: string, ancestor: string, descendant: string): Promise<boolean> {
    try {
      const base = (await this.#git(cwd).raw(["merge-base", ancestor, descendant])).trim();
      return base === ancestor;
    } catch {
      return false;
    }
  }

  /** `git diff <base>..<head> --name-only` — the round's mechanical changed-surface fileset (rules/
   *  write-boundary.ts reconcile input). [] for an empty diff; null on unresolvable rev / git error
   *  (fail-open — a diff we cannot compute is no evidence). */
  async diffNameOnly(cwd: string, base: string, head: string): Promise<string[] | null> {
    try {
      const out = (await this.#git(cwd).raw(["diff", "--name-only", `${base}..${head}`])).trim();
      if (!out) return [];
      return out.split("\n");
    } catch {
      return null;
    }
  }
}
