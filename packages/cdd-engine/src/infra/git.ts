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
