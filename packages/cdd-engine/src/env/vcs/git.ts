// packages/cdd-engine/src/env/vcs/git.ts
// The git read face: the two judgments the engine needs from the repository (where it
// is, and whether it is clean), plus the commit facts a dispatch records.
//
// Every read is FAIL-OPEN on the boundary the engine cares about: a non-repo, a missing
// branch or an unreadable git answers the declared empty value (null / false / []) and
// never throws across the seam. The two "cannot tell" shapes stay distinct from the
// "nothing there" shapes — a readable range with no change is `[]`, an absent base is
// `null` — because collapsing them would let a round claim it touched nothing when the
// engine in fact could not read.
//
// The class is stateless: construction is cheap and collaborators receive it injected.

import { simpleGit } from "simple-git";

/** One commit as the engine records it — the sha and the subject line. */
export interface GitCommit {
  /** The commit sha. */
  readonly sha: string;
  /** The commit subject line. */
  readonly subject: string;
}

/**
 * GitClient — the engine's git read adapter. Invariant: no method throws, and every
 * "cannot tell" answer stays distinguishable from an empty one.
 */
export class GitClient {
  /** The working directory the engine runs in — the default basis of every read. */
  readonly #cwd: string;

  constructor(cwd: string) {
    this.#cwd = cwd;
  }

  /** The repo root (`git rev-parse --show-toplevel`); null outside a repo. */
  async topLevel(cwd: string = this.#cwd): Promise<string | null> {
    try {
      return (await this.#git(cwd).revparse(["--show-toplevel"])).trim() || null;
    } catch {
      return null;
    }
  }

  /** Whether the working tree is clean — `git status --porcelain` = "". The workspace
   *  publishes its own keep-out marker, so the engine's run artifacts never read as
   *  uncommitted user work; the gate refuses genuinely dirty USER changes only. A
   *  non-repo counts dirty (the CDD flow needs git). */
  async isClean(cwd: string = this.#cwd): Promise<boolean> {
    try {
      return (await this.#git(cwd).status()).isClean();
    } catch {
      return false;
    }
  }

  /** The current HEAD sha; null outside a repo or on a branch with no commit yet (a
   *  present fact only, never a fabricated ref). */
  async head(cwd: string = this.#cwd): Promise<string | null> {
    try {
      return (await this.#git(cwd).revparse(["HEAD"])).trim() || null;
    } catch {
      return null;
    }
  }

  /** The paths the commits after `base` touched — deduped and blank-free. Three facts,
   *  never two: a readable range with no change is `[]`; an absent base, a non-repo or an
   *  unreadable git is `null`. */
  async pathsSince(
    base: string | null,
    cwd: string = this.#cwd,
  ): Promise<readonly string[] | null> {
    if (base === null) return null;
    try {
      const raw = await this.#git(cwd).raw([
        "log",
        "--name-only",
        "--pretty=format:",
        `${base}..HEAD`,
      ]);
      const paths = raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "");
      return [...new Set(paths)];
    } catch {
      return null;
    }
  }

  /** The commits added after `base`, oldest first. An absent base or an unreadable repo
   *  answers the empty list (fail-open: a diagnostic fact never breaks a record). */
  async commitsSince(base: string | null, cwd: string = this.#cwd): Promise<readonly GitCommit[]> {
    if (base === null) return [];
    try {
      const log = await this.#git(cwd).log({ from: base, to: "HEAD" });
      return log.all.map((entry) => ({ sha: entry.hash, subject: entry.message }));
    } catch {
      return [];
    }
  }

  /** The git handle of one directory — the single construction point. */
  #git(cwd: string) {
    return simpleGit({ baseDir: cwd });
  }
}
