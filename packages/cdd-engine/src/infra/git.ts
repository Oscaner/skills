// packages/cdd-engine/src/infra/git.ts — simple-git single-point wrapper (spec §2.13 git row).
// New dependency point for ALL git operations in rebuilt infra: status / add / commit / head / log /
// toplevel / cat-file. Replaces the hand-written git subprocess helpers that used to live in
// rules/commit.mjs (whose callers were re-pointed by Task 5 — this is now the single git seam).
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

function git(cwd: string) {
  return simpleGit({ baseDir: cwd });
}

/** repo root, mirroring `git rev-parse --show-toplevel` (old gitToplevel). */
export async function gitTopLevel(cwd: string): Promise<string | null> {
  try {
    return (await git(cwd).revparse(["--show-toplevel"])).trim() || null;
  } catch {
    return null;
  }
}

/** HEAD sha, mirroring `git rev-parse HEAD` (old gitRevParseHead). */
export async function gitRevParseHead(cwd: string): Promise<string | null> {
  try {
    return (await git(cwd).revparse(["HEAD"])).trim() || null;
  } catch {
    return null;
  }
}

/** `git status --porcelain` content; "" = clean tree (old gitStatusPorcelain). */
export async function gitStatusPorcelain(cwd: string): Promise<string | null> {
  try {
    return (await git(cwd).raw(["status", "--porcelain"])).trim();
  } catch {
    return null;
  }
}

/** `git add <paths>`; false on error (fail-open). */
export async function gitAdd(cwd: string, paths: string[]): Promise<boolean> {
  try {
    await git(cwd).add(paths);
    return true;
  } catch {
    return false;
  }
}

/** `git commit -m <message>`; returns the new HEAD sha, null on error (fail-open). */
export async function gitCommit(cwd: string, message: string): Promise<string | null> {
  try {
    const res = await git(cwd).commit(message);
    return res.commit || null;
  } catch {
    return null;
  }
}

/**
 * `git log` entries newest-first (returns null on error/empty). Each entry carries
 * hash/message/date — the consumer-facing log contract of this single git point.
 */
export async function gitLog(cwd: string, opts: GitLogOptions = {}): Promise<GitLogEntry[] | null> {
  try {
    const res = await git(cwd).log({ maxCount: opts.maxCount ?? 10 });
    return res.all.map((line) => ({ hash: line.hash, message: line.message, date: line.date }));
  } catch {
    return null;
  }
}

/** `git cat-file -e <sha>^{commit}` — true when sha is a real reachable commit (phantom-SHA guard). */
export async function gitCatFileCommitExists(cwd: string, sha: string | null | undefined): Promise<boolean> {
  if (!sha) return false;
  try {
    await git(cwd).catFile(["-e", `${sha}^{commit}`]);
    return true;
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

/** `git stash push -m <message>` — salvages the working-tree WIP into a stash (tracked + staged
 *  changes; untracked files stay). Returns the stash commit SHA, or null on no-changes / error
 *  (a clean tree has nothing to salvage — `git stash` errors "No local changes to save"). */
export async function gitStashPush(cwd: string, message: string): Promise<string | null> {
  try {
    await git(cwd).raw(["stash", "push", "-m", message]);
    return (await git(cwd).revparse(["stash@{0}"])).trim() || null;
  } catch {
    return null;
  }
}

/** `git stash apply <ref>` — restores the salvaged WIP to the working tree WITHOUT dropping the
 *  stash entry (apply, not pop: the stash stays until the operator or a later round drops it).
 *  false on error (fail-open — a refused apply must never throw across the seam). */
export async function gitStashApply(cwd: string, ref: string): Promise<boolean> {
  try {
    await git(cwd).raw(["stash", "apply", ref]);
    return true;
  } catch {
    return false;
  }
}

/** `git stash list --format=%gd\t%gs` — [{ ref: "stash@{N}", message }] newest-first (N=0 is the
 *  latest stash). Used by the resume legacy fallback to scan for a standardized stash message.
 *  null on error / empty list. */
export async function gitStashList(
  cwd: string,
): Promise<Array<{ ref: string; message: string }> | null> {
  try {
    const out = (await git(cwd).raw(["stash", "list", "--format=%gd%x09%gs"])).trim();
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
export async function gitDiffShortstat(cwd: string): Promise<string | null> {
  try {
    const out = (await git(cwd).raw(["diff", "HEAD", "--shortstat"])).trim();
    return out || "";
  } catch {
    return null;
  }
}
