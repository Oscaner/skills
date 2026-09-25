// scripts/lib/command.ts — the scripts CLI `Command` class family (Task 9 / P4.4).
// Converts run.ts's former inline `command()` factory + `invocationArgs` contract table
// (scripts/run.ts:49-93) into a Command class whose three facets are the brief's:
//   · meta — name/description/modulePath/kind (CommandMeta typed carrier);
//   · assemble — the citty CommandDef (declared args + the lazy run handler);
//   · invoke — lazy module dispatch (each subcommand's dependency graph loads only on
//     first use — the Task 21 lazy-load contract is untouched).
// run.ts is now a composition root: it declares the seven Command instances and mounts
// their assembled defs under mainCommand, never a forwarding shell to module mains.

import type { ArgsDef, CommandDef } from "citty";
import { defineCommand } from "citty";

/** Subcommand value passing — the contract between a run() handler and the lazily-loaded module
 * main (the forwarded args are the parsed citty args named by the subcommand's own argsDef):
 *   "none"    → main() — zero-arg mains (emit/emit-check/validate/precommit/smoke-cdd must never
 *              see an options object in that slot);
 *   "dry-run" → main({ dryRun }) — version's destructured option (presence-based boolean: absent
 *              → false, present → true);
 *   "target"  → main(target) — apply-rules' single mandatory positional. */
export type InvocationKind = "none" | "dry-run" | "target";

/** Command identity — the meta facet (typed carrier, 判定标准⑥). */
export interface CommandMeta {
  name: string;
  description: string;
  /** lazy import target — the module that exports the command's `main` */
  modulePath: string;
  /** selects the invocation contract (InvocationKind) */
  kind: InvocationKind;
}

/** Per-kind invocation contract — one table holds both the citty args declaration (#argsDef)
 * and the forwarded-value mapping (invocationArgs), so the InvocationKind union is switched
 * exactly once (the brief's contract-table shape). */
interface InvocationFacet {
  argsDef: ArgsDef;
  forwarded: (args: Record<string, unknown>) => unknown[];
}

const INVOCATION_FACETS: Record<InvocationKind, InvocationFacet> = {
  none: { argsDef: {}, forwarded: () => [] },
  "dry-run": {
    argsDef: { "dry-run": { type: "boolean", description: "preview without writing" } },
    forwarded: (args) => [{ dryRun: args["dry-run"] === true }],
  },
  target: {
    argsDef: { target: { type: "positional", description: "protect-develop | protect-main" } },
    forwarded: (args) => [args.target],
  },
};

export class Command {
  readonly meta: CommandMeta;
  #baseUrl: string;

  /** @param baseUrl the composition root's module URL (`import.meta.url` of run.ts) — the
   *  lazy-import specifier resolves against it, so `modulePath` stays scripts-root-relative. */
  constructor(meta: CommandMeta, baseUrl: string) {
    this.meta = meta;
    this.#baseUrl = baseUrl;
  }

  /** The invocation contract — the values a forwarded run() passes to the module main. */
  invocationArgs(args: Record<string, unknown>): unknown[] {
    return INVOCATION_FACETS[this.meta.kind].forwarded(args);
  }

  #argsDef(): ArgsDef {
    return INVOCATION_FACETS[this.meta.kind].argsDef;
  }

  /** 装配 — the citty CommandDef the composition root mounts under mainCommand. */
  assemble(): CommandDef {
    return defineCommand({
      meta: { name: this.meta.name, description: this.meta.description },
      args: this.#argsDef(),
      run: async ({ args }) => {
        await this.invoke(args as Record<string, unknown>);
      },
    });
  }

  /** invoke — lazy module dispatch. A numeric module-main return is an exit code
   * (validate/version/apply-rules main → 1 on failure); undefined returners
   * (emit/emit-check/smoke-cdd) rely on the top-level catch for non-zero. */
  async invoke(args: Record<string, unknown>): Promise<void> {
    const mod = (await import(new URL(this.meta.modulePath, this.#baseUrl).href)) as {
      main(...forwarded: unknown[]): unknown;
    };
    const code = await mod.main(...this.invocationArgs(args));
    if (typeof code === "number") process.exitCode = code;
  }
}
