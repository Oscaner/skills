// packages/cdd-engine/src/env/index.ts
// Every write goes through one declared, atomic, previewable path.
//
// `Env` is the external world's one adapter, constructed once at the composition root
// and handed to the other three slices as an instance. This wave delivers two of its
// four segments:
//
//   paths     — the path basis (`RepoRoot`), the doc roots (`DocRoots`) and the slug
//               index (`SlugIndex`): how a repository spells its own coordinates.
//   workspace — the `.kairos` layout, the atomic write, the round log, the carrier seal
//               and the base artifact: the only place in `src/**` that writes.
//
// `process/` (clock, host probe, lock) and `vcs/` (git reads) arrive in later waves and
// join this facade then. `Env` knows no CDD semantics: no round, no document type, no
// judgment — those live above it.
//
// Two external facts arrive through the constructor and are never defaulted here: `now`
// (the clock; `env/process/clock.ts` supplies the only production implementation) and
// `baseName` (the base artifact's file name, derived from the artifact matrix). A
// defaulted clock would make every timestamp a second truth, and a defaulted file name
// would put the spelling matrix in two homes.

import { type DocRoots, docRootsOf } from "./paths/doc-roots.ts";
import { RepoRoot } from "./paths/root.ts";
import { SlugIndex, type SlugReader } from "./paths/slug-index.ts";
import type { FileOps } from "./workspace/atomic.ts";
import { WorkspaceRoot } from "./workspace/workspace.ts";

/** The paths segment — the path basis and the document coordinates over it. */
export class Paths {
  readonly root: RepoRoot;
  readonly docs: DocRoots;

  constructor(root: RepoRoot) {
    this.root = root;
    this.docs = docRootsOf(root);
  }

  /** Resolve one working directory into the paths segment. A directory that is not
   *  inside a git tree throws — an unresolvable basis never degrades to the cwd. */
  static of(cwd: string): Paths {
    return new Paths(RepoRoot.of(cwd));
  }

  /** Scan the doc roots into the slug index; `slugOf` is the document world's reading
   *  of one document's declared slug (injected, so `env/` parses no front matter). */
  slugIndex(slugOf: SlugReader): SlugIndex {
    return SlugIndex.scan(this.root, this.docs, slugOf);
  }
}

/** The facts one `Env` is constructed from. */
export interface EnvOptions {
  /** The working directory the repository root is derived from. */
  readonly cwd?: string;
  /** The clock every artifact timestamps through — required, no default. */
  readonly now: () => number;
  /** The base artifact's file name — required, no default. */
  readonly baseName: string;
  /** The workspace family's repo-relative segment; `.kairos/cdd` by default. */
  readonly workspaceRoot?: string;
  /** The syscall layout, when a caller drives the workspace over its own file system. */
  readonly ops?: FileOps;
}

/** Every write goes through one declared, atomic, previewable path — the workspace is
 *  the engine's only landing place, and `Env` is the one adapter that holds it. */
export class Env {
  readonly paths: Paths;
  readonly workspace: WorkspaceRoot;

  constructor(opts: EnvOptions) {
    const paths = Paths.of(opts.cwd ?? process.cwd());
    this.paths = paths;
    this.workspace = new WorkspaceRoot({
      basis: paths.root,
      now: opts.now,
      baseName: opts.baseName,
      segment: opts.workspaceRoot,
      ops: opts.ops,
    });
  }
}
