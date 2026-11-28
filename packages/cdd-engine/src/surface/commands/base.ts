// packages/cdd-engine/src/surface/commands/base.ts
// `cdd base set|get` — the base artifact's two leaves.
//
// INVARIANT — three actions and no fourth: read the parsed flags, call ONE `env/` entry
// (`BaseArtifact#read` or `#write`), hand its return value to the ONE output face. The
// conflict judgment lives in `env/workspace/base-artifact.ts#BaseArtifact#write`, so a shell
// never compares two bases; the instance itself is the composition root's (`Workspace#baseOf`
// through the injected resolver), which is why no `new` appears here.

import type { RepoPath } from "../../env/paths/root.ts";
import type {
  BaseArtifact,
  BaseSource,
  BaseWriteInput,
} from "../../env/workspace/base-artifact.ts";
import type { CliOutcome, CommandReporter, ParsedCommand } from "./declare.ts";

/** One `base` invocation's resolved artifact — the workspace and the plan coordinate the
 *  artifact serves. */
export interface BaseTarget {
  /** The workspace's artifact, constructed by the composition root. */
  readonly artifact: BaseArtifact;
  /** The plan coordinate the artifact records, already repo-relative. */
  readonly plan: RepoPath;
}

/** The resolution's declared answer — a target, or the value the command's bytes come from
 *  when the plan names no workspace. That refusal is decided OUTSIDE the shell, so the shell
 *  keeps no branch of its own. */
export type BaseResolution =
  | { readonly kind: "resolved"; readonly target: BaseTarget }
  | { readonly kind: "refused"; readonly outcome: CliOutcome };

/** The resolver a shell is constructed with — the composition root's one path from an argv
 *  `--plan` to a workspace artifact. */
export type BaseResolver = (planArg: string) => BaseResolution;

/** BaseCommand — the `base` shell. Invariant: one entry per leaf, one report (see the file's
 *  header). */
export class BaseCommand {
  readonly #resolve: BaseResolver;
  readonly #report: CommandReporter;

  constructor(opts: { readonly resolve: BaseResolver; readonly report: CommandReporter }) {
    this.#resolve = opts.resolve;
    this.#report = opts.report;
  }

  /** Run one `base set` / `base get` invocation — the leaf word picks the ONE entry. */
  run(parsed: ParsedCommand): number {
    const resolved = this.#resolve(parsed.args.plan ?? "");
    if (resolved.kind === "refused") {
      return this.#report.report(resolved.outcome, parsed.commandPath);
    }
    const { artifact, plan } = resolved.target;
    const outcome: CliOutcome =
      parsed.leaf === "set"
        ? { kind: "base-write", value: artifact.write(BaseCommand.writeOf(parsed, plan)) }
        : { kind: "base-read", value: artifact.read() };
    return this.#report.report(outcome, parsed.commandPath);
  }

  /** The `set` leaf's request — the parsed cells and the resolved plan coordinate, handed
   *  over unchanged (the conflict predicate, and every word it prints, stay in `env/`). */
  static writeOf(parsed: ParsedCommand, plan: RepoPath): BaseWriteInput {
    return {
      base: parsed.args.base ?? "",
      source: (parsed.args.source ?? "plan-field") as BaseSource,
      plan,
      force: parsed.args.force === "true",
    };
  }
}
