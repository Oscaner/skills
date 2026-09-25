// packages/cdd-engine/src/infra/git.ts — GitClient: the simple-git single-point domain service
// class (Task 7 OOP restructure; spec §2.13 git row + 判定标准② — every git operation is a method,
// zero bare function exports). New dependency point for ALL git operations in rebuilt infra:
// status / add / commit / head / log / toplevel / cat-file. Replaces the hand-written git
// subprocess helpers that used to live in rules/commit.mjs (whose callers were re-pointed by
// Task 5 — this is now the single git seam).
// Fail-open contracts mirror the old helpers exactly: non-repo or git error → null (string ops) /
// false (boolean ops); no exception crosses the seam.

import { readFileSync } from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";

export interface GitLogOptions {
  maxCount?: number;
}

export interface GitLogEntry {
  hash: string;
  message: string;
  date: string;
}

/** The structured WIP scale — file count + insertion/deletion magnitudes (tracked diffs exact,
 *  untracked files exact by line count). */
export interface WipStat {
  files: number;
  insertions: number;
  deletions: number;
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

  /** `git commit -m <message>`; returns the new HEAD sha, null on error (fail-open). */
  async commit(cwd: string, message: string): Promise<string | null> {
    try {
      const res = await this.#git(cwd).commit(message);
      return res.commit || null;
    } catch {
      return null;
    }
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

  // ---- residue stash helpers (T26 resume-from-residue, spec T7.5) ----
  // The salvage/resume pairing is engine-internal git: settleResidue pushes a stash, the re-dispatch
  // applies it. One subtlety drives the ref choice: `stash@{N}` indices SHIFT on every new stash and
  // drop, so `recovery.residue_ref` stores the stash COMMIT SHA (`git rev-parse stash@{0}` right after
  // push) — `git stash apply <sha>` is index-independent. The legacy fallback (carriers written before
  // the recovery field existed) matches `git stash list` by the STANDARDIZED stash message
  // (`cdd-<op>-<type>-<task>-r<round>-<cause>` — src/artifacts/residue.ts single source), never by
  // index.

  /** `git stash push -u -m <message>` — salvages the working-tree WIP into a stash (tracked, staged
   *  AND brand-new untracked files; `-u` sweeps the un-added files that are the normal TDD shape for
   *  new tests/modules, so a dead round resumes with the complete tree). Returns the stash commit
   *  SHA, or null on no-changes / error (a clean tree has nothing to salvage — `git stash` errors
   *  "No local changes to save"). */
  async stashPush(cwd: string, message: string): Promise<string | null> {
    try {
      await this.#git(cwd).raw(["stash", "push", "-u", "-m", message]);
      return (await this.#git(cwd).revparse(["stash@{0}"])).trim() || null;
    } catch {
      return null;
    }
  }

  /** `git stash apply <ref>` — restores the salvaged WIP to the working tree WITHOUT dropping the
   *  stash entry (apply, not pop: the stash stays until the operator or a later round drops it).
   *  false on error (fail-open — a refused apply must never throw across the seam). */
  async stashApply(cwd: string, ref: string): Promise<boolean> {
    try {
      await this.#git(cwd).raw(["stash", "apply", ref]);
      return true;
    } catch {
      return false;
    }
  }

  /** `git stash list --format=%gd\t%gs` — [{ ref: "stash@{N}", message }] newest-first (N=0 is the
   *  latest stash). Used by the resume legacy fallback to scan for a standardized stash message.
   *  null on error / empty list. */
  async stashList(cwd: string): Promise<Array<{ ref: string; message: string }> | null> {
    try {
      const out = (await this.#git(cwd).raw(["stash", "list", "--format=%gd%x09%gs"])).trim();
      if (!out) return [];
      return out.split("\n").map((line) => {
        const [ref, ...rest] = line.split("\t");
        // `%gs` is the reflog subject, which git prefixes with "On <branch>: " — strip it so
        // `message` is the raw stash message (the standardized-name contract the resume scan
        // matches against; branch names cannot contain ":" so [^:]* is exact).
        const message = rest.join("\t").replace(/^On [^:]*: /, "");
        return { ref, message };
      });
    } catch {
      return null;
    }
  }

  /** `git diff HEAD --shortstat` — the WIP scope summary (staged + unstaged vs HEAD) recorded into
   *  `recovery.residue_scope` at salvage time (data-driven appendix input). "" when the tree is clean
   *  (the index+worktree content equals HEAD). null on git error. */
  async diffShortstat(cwd: string): Promise<string | null> {
    try {
      const out = (await this.#git(cwd).raw(["diff", "HEAD", "--shortstat"])).trim();
      return out || "";
    } catch {
      return null;
    }
  }

  // ---- residue WIP scale (canonical settleResidue input — src/artifacts/residue.ts save family) ----
  // The structured WIP scale (files / insertions / deletions) that `recovery.wip_stat` carries at
  // salvage time — the data-driven (file count / +M/−M) the recovery carrier archives next to residue_ref.
  // Unlike `git diff HEAD --shortstat` (tracked only), the scale also counts brand-new UNTRACKED
  // files (the normal TDD shape for new tests/modules): each untracked entry counts as one file with
  // its newline-count as insertions — `git diff --numstat` cannot see untracked files, so the count
  // is derived from a per-file line read instead of a second git walk. Pass-through carriers never
  // count: the engine handoff lives in the gitignored `.osuperpowers/cdd/` workspace (materializeWorkspace
  // writes an in-dir `.gitignore`), so it never appears in porcelain as `??` in the first place.

  async diffNumstat(cwd: string): Promise<WipStat> {
    // Fail-open like the rest of this seam: a non-repo / nonexistent cwd (or any git error) yields
    // the zero scale — settleResidue's "git error → null, never crash" contract must hold even when
    // its inputs are mocked or already torn down (the round-terminal write always survives).
    try {
      const out = (await this.#git(cwd).raw(["diff", "HEAD", "--numstat"])).trim();
      let files = 0;
      let insertions = 0;
      let deletions = 0;
      for (const line of out.split("\n")) {
        const [ins, del, ..._rest] = line.trim().split("\t");
        if (!ins || !del) continue;
        const i = Number(ins);
        const d = Number(del);
        if (Number.isNaN(i) || Number.isNaN(d)) continue; // binary rename lines (-\t-) never count
        files += 1;
        insertions += i;
        deletions += d;
      }
      return { files, insertions, deletions };
    } catch {
      return { files: 0, insertions: 0, deletions: 0 };
    }
  }

  /** Untracked-file scale contribution: each untracked entry is one file; insertions = its
   *  newline count (a new file's magnitude is its own lines — `git diff --numstat` has no row for it).
   *  Directories (`?? dir/`) contribute presence only (+1, no line read). The count of entries is
   *  `returned.files` — callers never re-parse porcelain for the untracked-file count. A caller that
   *  already fetched `git status --porcelain` (settleResidue reads it once for both the scope count
   *  and this scale) passes it as `porcelain` so one tree walk serves both; null/undefined → one
   *  internal fetch (the standalone-call shape). */
  async untrackedStat(cwd: string, porcelain?: string | null): Promise<WipStat> {
    const out = (porcelain ?? (await this.statusPorcelain(cwd)) ?? "").split("\n");
    let files = 0;
    let insertions = 0;
    for (const line of out) {
      if (!line.startsWith("?? ")) continue;
      const rel = line.slice(3).replace(/\/$/, "");
      files += 1;
      if (line.endsWith("/")) continue; // untracked directory — presence only
      try {
        const src = readFileSync(path.join(cwd, rel), "utf8");
        insertions += src === "" ? 1 : src.split("\n").length - 1;
      } catch {
        insertions += 1; // unreadable → +1 presence (scale stays defined)
      }
    }
    return { files, insertions, deletions: 0 };
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
