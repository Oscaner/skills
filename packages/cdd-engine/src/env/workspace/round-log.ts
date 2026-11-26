// packages/cdd-engine/src/env/workspace/round-log.ts
// The round-log LAYOUT: where one dispatched round's append-only log lives. The log
// itself (an open stream, a fault channel, a liveness reader) belongs to the dispatch
// face; this file owns only the coordinate, so the write face and the reader can never
// disagree about where a round's log is.
//
// Invariant: one round name maps to exactly one repo-relative log path under the
// workspace's own `logs/` segment — never the workspace root, never a slug directory.

import { mkdirSync } from "node:fs";
import path from "node:path";
import type { RepoPath, RepoRoot } from "../paths/root.ts";

/** The round-log coordinate over one workspace. */
export class RoundLogLayout {
  /** The `logs/` segment inside a workspace — one spelling. */
  static readonly SEGMENT = "logs";

  /** The log file's suffix — one spelling. */
  static readonly SUFFIX = ".log";

  readonly #workspacePath: string;
  readonly #basis: RepoRoot;

  constructor(workspacePath: string, basis: RepoRoot) {
    this.#workspacePath = workspacePath;
    this.#basis = basis;
  }

  /** One round's log path, repo-relative; the containing directory is created so a
   *  reader that opens the returned coordinate never races the writer's mkdir. */
  pathOf(name: string): RepoPath {
    const directory = path.join(this.#workspacePath, RoundLogLayout.SEGMENT);
    mkdirSync(directory, { recursive: true });
    return this.#basis.relativize(path.join(directory, `${name}${RoundLogLayout.SUFFIX}`));
  }
}
