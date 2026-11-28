// packages/cdd-engine/src/env/index.ts
// Every write goes through one declared, atomic, previewable path.
//
// `Env` is the external world's one adapter, constructed once at the composition root
// and handed to the other three slices as an instance. It has five segments:
//
//   paths     — the path basis (`RepoRoot`), the doc roots (`DocRoots`) and the slug
//               index (`SlugIndex`): how a repository spells its own coordinates.
//   workspace — the `.kairos` layout, the atomic write, the round log, the carrier seal
//               and the base artifact: the only place in `src/**` that writes.
//   process   — the process facts, the harness contract and its ONE probe, the clock,
//               the child seam and the lock: everything the engine asks of the OS and
//               of the machine it runs on.
//   vcs       — git reads and the plan source: what the repository itself says.
//   provision — the harness install / update sequence: the outside world touched through
//               declared, previewable steps. It sits inside `env/` rather than in a slice
//               of its own because it keeps THIS segment's invariant (only a declared,
//               atomic, previewable step touches the outside world) — the object differs,
//               the rule does not.
//
// `Env` knows no CDD semantics: no round, no document type, no judgment — those live
// above it. The clock is the one fact that has a production default: `Clock` IS the
// single clock (its own file is the only reader of the system time), so a missing
// injected clock means "the real one", never a second spelling of a timestamp.

import type { DocRoots } from "./paths/doc-roots.ts";
import { docRootsOf } from "./paths/doc-roots.ts";
import { type OutsideRepo, RepoRoot } from "./paths/root.ts";
import {
  type DirectoryListing,
  NodeDirectoryListing,
  SlugIndex,
  type SlugReader,
} from "./paths/slug-index.ts";
import { type ChildRunner, Terminator } from "./process/child-runner.ts";
import { Clock } from "./process/clock.ts";
import { detectHost, type HostEnv, type HostId, type HostProbe } from "./process/host.ts";
import { Lock, type LockHolderReader } from "./process/lock.ts";
import { Provisioner, type StepRunner } from "./provision/init.ts";
import { GitClient } from "./vcs/git.ts";
import { type PlanSource, planSourceOf } from "./vcs/plan-source.ts";
import type { FileOps } from "./workspace/atomic.ts";
import { WorkspaceRoot } from "./workspace/workspace.ts";

/** The paths segment — the path basis and the document coordinates over it. */
export class Paths {
  readonly root: RepoRoot;
  readonly docs: DocRoots;

  /** The repository's directory listing — the ONE enumeration of "which names sit under
   *  this coordinate", so a document scan, a workspace name read and an existence probe all
   *  answer from one spelling instead of opening a directory of their own. */
  readonly listing: DirectoryListing;

  constructor(root: RepoRoot, listing?: DirectoryListing) {
    this.root = root;
    this.docs = docRootsOf(root);
    this.listing = listing ?? new NodeDirectoryListing(root);
  }

  /** Resolve one working directory into the paths segment. A directory that is not
   *  inside a git tree throws — an unresolvable basis never degrades to the cwd. */
  static of(cwd: string, outside?: OutsideRepo): Paths {
    return new Paths(RepoRoot.of(cwd, outside));
  }

  /** Scan the doc roots into the slug index; `slugOf` is the document world's reading
   *  of one document's declared slug (injected, so `env/` parses no front matter). */
  slugIndex(slugOf: SlugReader): SlugIndex {
    return SlugIndex.scan(this.root, this.docs, slugOf, this.listing);
  }
}

/**
 * Process — the machine's facts. Invariant: the harness is detected AT MOST ONCE per
 * environment, the clock is the only time reader, and the child seam is started and
 * killed here while WHEN to kill is the dispatch face's call.
 */
export class Process {
  /** The one clock every timestamp prints through. */
  readonly clock: Clock;

  /** The child seam the dispatch face spawns through. */
  readonly runner: ChildRunner;

  /** The environment view the host probe reads. */
  readonly #env: HostEnv;

  /** The host probe — `detectHost` in production; a counting stub in a pin. */
  readonly #probe: HostProbe;

  /** The detected host, memoised: `null` until the first read, then the answer (an
   *  empty string is a real answer — "no harness detected"). */
  #host: HostId | "" | null = null;

  constructor(opts: { clock?: Clock; runner?: ChildRunner; probe?: HostProbe; env?: HostEnv }) {
    this.clock = opts.clock ?? new Clock();
    this.runner = opts.runner ?? new Terminator();
    this.#probe = opts.probe ?? detectHost;
    this.#env = opts.env ?? process.env;
  }

  /** The dispatch host of this machine — the probe's answer, read once and remembered,
   *  so two reads can never disagree about the harness. */
  host(): HostId | "" {
    if (this.#host === null) this.#host = this.#probe(this.#env);
    return this.#host;
  }

  /** The lock over one target file, with the caller's own holder reader. */
  lockOf(opts: { target: string; holderOf?: LockHolderReader }): Lock {
    return new Lock(opts);
  }
}

/** The vcs segment — what the repository itself says: git reads and the plan source. */
export class Vcs {
  /** The git read face. */
  readonly git: GitClient;

  readonly #root: RepoRoot;
  readonly #docs: DocRoots;

  constructor(opts: { root: RepoRoot; docs: DocRoots; git?: GitClient }) {
    this.#root = opts.root;
    this.#docs = opts.docs;
    this.git = opts.git ?? new GitClient(opts.root.absolute);
  }

  /** The plan source over the command's ONE slug index (two scans of the doc roots
   *  would let one read answer from a stale index). */
  plansOf(index: SlugIndex): PlanSource {
    return planSourceOf({ root: this.#root, docs: this.#docs, index });
  }
}

/** The facts one `Env` is constructed from. */
export interface EnvOptions {
  /** The working directory the repository root is derived from. */
  readonly cwd?: string;
  /** The clock every artifact timestamps through — `Clock` (the system clock) when
   *  omitted, because that class is the one holder of the time fact. */
  readonly clock?: Clock;
  /** The base artifact's file name — required, no default. */
  readonly baseName: string;
  /** The workspace family's repo-relative segment; `.kairos/cdd` by default. */
  readonly workspaceRoot?: string;
  /** The syscall layout, when a caller drives the workspace over its own file system. */
  readonly ops?: FileOps;
  /** The directory listing, when a caller drives the tree over a fabricated one. */
  readonly listing?: DirectoryListing;
  /** Where a CALLER path that resolves outside the repository is reported — the composition
   *  root wires it to the word table; a caller that injects none keeps the silent form. */
  readonly outside?: OutsideRepo;
  /** The host probe, when a caller needs to count or pin the detection. */
  readonly hostProbe?: HostProbe;
  /** The environment view the host probe reads; `process.env` by default. */
  readonly hostEnv?: HostEnv;
  /** The child seam, when a caller drives a dispatch over a stub. */
  readonly runner?: ChildRunner;
  /** The git read face, when a caller drives a repository other than the cwd's. */
  readonly git?: GitClient;
  /** The provisioning step seam, when a caller drives an install plan without spawning. */
  readonly stepRunner?: StepRunner;
}

/** Every write goes through one declared, atomic, previewable path — the workspace is
 *  the engine's only landing place, and `Env` is the one adapter that holds it. */
export class Env {
  /** How a repository spells its own coordinates. */
  readonly paths: Paths;

  /** The `.kairos` layout and the ONLY write face. */
  readonly workspace: WorkspaceRoot;

  /** The machine's facts: clock · host · child seam · lock. */
  readonly process: Process;

  /** The repository's own facts: git and the plan source. */
  readonly vcs: Vcs;

  /** The harness's install / update sequence — step plan and step run. */
  readonly provision: Provisioner;

  constructor(opts: EnvOptions) {
    this.paths = new Paths(RepoRoot.of(opts.cwd ?? process.cwd(), opts.outside), opts.listing);
    this.process = new Process({
      clock: opts.clock,
      runner: opts.runner,
      probe: opts.hostProbe,
      env: opts.hostEnv,
    });
    this.workspace = new WorkspaceRoot({
      basis: this.paths.root,
      now: this.process.clock.now,
      baseName: opts.baseName,
      segment: opts.workspaceRoot,
      ops: opts.ops,
    });
    this.vcs = new Vcs({ root: this.paths.root, docs: this.paths.docs, git: opts.git });
    this.provision = new Provisioner({ runner: opts.stepRunner });
  }
}
