// packages/cdd-engine/src-next/infra/root.ts
// T1 — the path value-object pair (design spec §2.2): the ONE authority for the
// path BASIS (repoRoot) and the ONE type for the canonical path SHAPE
// (repoRoot-relative).
//
//   RepoRoot  — the value object holding the already-resolved absolute root
//               string (the resolution — `git.topLevel(process.cwd())` — is T2;
//               this plane stays resolution-free so no import cycle forms). Its
//               two methods are the ONLY conversion pair over the path basis:
//                 · relativize(input)  — the ONE construction entry: any absolute
//                   or caller-relative input → the branded, repoRoot-relative
//                   `RepoPath` (the user-input read-in point).
//                 · resolve(rel)       — the ONE erasure point: a `RepoPath` →
//                   the absolute `string` fed to `fs` / `git` / `execa` at the
//                   syscall boundary.
//
//   RepoPath  — a branded string. The brand lifts the canonical shape to the type
//               level: the absolute state is UNREPRESENTABLE as a `RepoPath`, so a
//               bare `string` can never reach a read/write face (compile-time
//               guard — §2.2's read/write contract). The absolute form is
//               transient at the syscall boundary only: it is produced by
//               `resolve`, never persisted, never compared, never passed across a
//               layer (spec §2.1).
//
// The whole plane is pure string arithmetic over `node:path` (zero syscall, zero
// `process.cwd()` read) — the value object never touches the filesystem.
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import path from "node:path";

/** The branded repoRoot-relative path — the canonical shape lifted to the type
 *  level. The brand makes the absolute state unrepresentable: only `RepoRoot
 *  .relativize` constructs one, and only `RepoRoot.resolve` erases it to the
 *  absolute syscall string. */
export type RepoPath = string & { readonly __repoPath: unique symbol };

/** The path-basis value object — the root-basis single source plus the ONE
 *  relativize/resolve conversion pair (spec §2.2). Constructed with the
 *  ALREADY-resolved absolute root string (resolution is T2 — this plane never
 *  reads `process.cwd()`); stateless after construction, so one instance is
 *  shared safely. */
export class RepoRoot {
  /** The absolute root string — the basis every relativize/resolve is taken
   *  against. Stored verbatim (never re-resolved: resolution is the caller's —
   *  T2 — and a re-resolution here would smuggle a `process.cwd()` read into the
   *  pure plane). */
  readonly absolute: string;

  constructor(absolute: string) {
    this.absolute = absolute;
  }

  /** The ONE construction entry — normalize any absolute-or-relative input to the
   *  branded repoRoot-relative `RepoPath`. An absolute input is taken relative to
   *  the root; a caller-relative input is resolved against the root first (so a
   *  bare `docs/x.md` is read relative to repoRoot, NEVER to `process.cwd()`).
   *  An out-of-repo input (`../outside/x.md`) keeps the single relative FORM — the
   *  result carries `..` segments, is NOT rejected and never throws (spec §2.10:
   *  the shape is what is judged, not the location). An empty input relativizes to
   *  the empty string (root against itself). */
  relativize(input: string): RepoPath {
    return path.relative(this.absolute, path.resolve(this.absolute, input)) as RepoPath;
  }

  /** The ONE erasure point — a `RepoPath` back to the absolute `string` fed to
   *  `fs` / `git` / `execa`. The absolute form exists only here, transient at the
   *  syscall boundary. */
  resolve(rel: RepoPath): string {
    return path.resolve(this.absolute, rel);
  }
}
