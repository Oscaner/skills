// packages/cdd-engine/src/env/paths/root.ts
// The path basis of the new tree: one value object holding the already-resolved
// repository root, plus the ONE canonical repo-relative path shape (`RepoPath`).
//
//   RepoRoot  — the resolved absolute root string. Its methods are the ONLY
//               conversions over the basis:
//                 · callerPath(input) — the CALLER's coordinate: the projection below
//                   plus the out-of-tree report (an argv path that leaves the repository
//                   is accepted — the shape is what is judged, never the location — and
//                   stated once to the injected `OutsideRepo` sink);
//                 · relativize(input) — the silent projection (the engine's own recorded
//                   coordinates: a persisted absolute path another root wrote is not the
//                   caller's mistake);
//                 · resolve(rel)      — a `RepoPath` → the absolute string fed to
//                   `fs` / `git` / `execa` at the syscall boundary.
//               `of(cwd)` is the ONE resolution entry: the git top level of `cwd`.
//               A tree that cannot be derived throws — an unresolvable basis must
//               never degrade into the current directory, because every path below
//               it would then be spelled from the wrong root.
//
//   RepoPath  — a branded string. The brand lifts the canonical shape to the type
//               level: the absolute state is unrepresentable as a `RepoPath`, so a
//               bare string never reaches a read or write face. The absolute form is
//               transient at the syscall boundary only — produced by `resolve`, never
//               persisted, never compared.
//
// The class is pure string arithmetic over `node:path` after construction; the one
// syscall is the resolution inside `of`. Zero clock reads.

import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";

/** The branded repo-relative path — the canonical shape lifted to the type level. */
export type RepoPath = string & { readonly __repoPath: unique symbol };

/** The one caller a path that LEFT the repository is reported to. `env/` states the FACT (this
 *  coordinate resolves outside the root) and spells no sentence: the bytes belong to the word
 *  table, which only the surface may read. */
export type OutsideRepo = (rel: RepoPath) => void;

/** The path-basis value object — the root-basis single source plus its conversion pair.
 *  Immutable after construction. */
export class RepoRoot {
  /** The absolute root string every conversion is taken against. */
  readonly absolute: string;

  /** The out-of-tree report, absent when the caller wants the silent form (a pin, a read that
   *  never sees argv). */
  readonly #outside: OutsideRepo | null;

  constructor(absolute: string, outside?: OutsideRepo) {
    this.absolute = absolute;
    this.#outside = outside ?? null;
  }

  /** Derive the basis from a working directory — the git top level of `cwd`. Not
   *  running inside a git tree is a real failure: the message names the cwd so the
   *  refusal points at the directory that was read, never at a stack frame. */
  static of(cwd: string, outside?: OutsideRepo): RepoRoot {
    const resolved = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
    });
    const top = (resolved.stdout ?? "").trim();
    if (resolved.status !== 0 || top.length === 0) {
      throw new Error(`RepoRoot.of: ${cwd} is not inside a git working tree`);
    }
    return new RepoRoot(realpathSync(top), outside);
  }

  /** The CALLER's coordinate — the projection below plus the ONE out-of-tree report. An
   *  argv path that leaves the repository is accepted (the shape is what is judged, never the
   *  location) and stated to the sink; every argv land uses THIS entry, so no command family
   *  owns a second spelling of the warning. */
  callerPath(input: string): RepoPath {
    const rel = this.relativize(input);
    if (RepoRoot.#isOutside(rel)) this.#outside?.(rel);
    return rel;
  }

  /** The ONE projection — normalize an absolute-or-relative input to the branded
   *  repo-relative `RepoPath`. An absolute input is taken relative to the root; a
   *  caller-relative input is resolved against the root first, so a bare `docs/x.md` never
   *  means "relative to the process cwd". An out-of-tree input keeps the single relative form
   *  (it carries `..` segments and is not rejected). SILENT by contract: the engine's own
   *  recorded coordinates come through here, and a persisted absolute path another root wrote
   *  is not the caller's mistake — `callerPath` is the reporting entry. */
  relativize(input: string): RepoPath {
    return path.relative(this.absolute, path.resolve(this.absolute, input)) as RepoPath;
  }

  /** Whether one projected path carries `..` — the out-of-tree shape, judged on the RESULT so
   *  an input spelled either way is one answer. */
  static #isOutside(rel: RepoPath): boolean {
    return rel.split(path.sep).includes("..");
  }

  /** The ONE erasure point — a `RepoPath` back to the absolute syscall string. */
  resolve(rel: RepoPath): string {
    return path.resolve(this.absolute, rel);
  }
}
