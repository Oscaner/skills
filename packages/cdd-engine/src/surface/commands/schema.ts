// packages/cdd-engine/src/surface/commands/schema.ts
// `cdd schema get <type> [<target>]` — the two schema faces behind one leaf.
//
// INVARIANT — the ONE value-dispatching shell: `--output` picks between `Documents`' TWO
// entries (`skeletonAt` when `--output skeleton`, `projectOf` for the json face), and there is
// no second branch beneath that pick. The type word, the target's number and the write itself
// are all the document slice's: the shell renders nothing, writes nothing and never asks how
// many targets the json face takes.

import type { DocType } from "../../docs/identity/types.ts";
import type { Documents, ProjectionResult, SkeletonWrite } from "../../docs/index.ts";
import type { RepoPath } from "../../env/paths/root.ts";
import type { CliOutcome, CommandReporter, ParsedCommand } from "./declare.ts";

/** The shell's path face — the composition root's one relativize landing, so the shell never
 *  owns a repository basis. */
export type RelativePath = (raw: string) => RepoPath;

/** SchemaCommand — the `schema` shell. Invariant: one `--output` value dispatch, one report
 *  (see the file's header). */
export class SchemaCommand {
  readonly #documents: Documents;
  readonly #relative: RelativePath;
  readonly #report: CommandReporter;

  constructor(opts: {
    readonly documents: Documents;
    readonly relative: RelativePath;
    readonly report: CommandReporter;
  }) {
    this.#documents = opts.documents;
    this.#relative = opts.relative;
    this.#report = opts.report;
  }

  /** Run one `schema get` invocation. The two positional cells are the type (already
   *  normalized by the parse) and the optional target. */
  run(parsed: ParsedCommand): number {
    const [rawType, rawTarget] = parsed.positionals;
    const type = (rawType ?? "") as DocType;
    const outcome: CliOutcome =
      parsed.args.output === "skeleton"
        ? {
            kind: "skeleton",
            value: this.#documents.skeletonAt(
              type,
              rawTarget === undefined ? undefined : this.#relative(rawTarget),
            ) satisfies SkeletonWrite,
          }
        : {
            kind: "projection",
            value: this.#documents.projectOf(
              type,
              rawTarget === undefined ? undefined : this.#relative(rawTarget),
            ) satisfies ProjectionResult,
          };
    return this.#report.report(outcome, parsed.commandPath);
  }
}
