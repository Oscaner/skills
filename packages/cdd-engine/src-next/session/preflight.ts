// packages/cdd-engine/src-next/session/preflight.ts
// P4.1 T1 — the lifecycle pre-flight seam (design spec §1): the dispatch gates
// converge into ONE single-entry gate a work command consults before ANY child
// dispatch — the clean-tree hard gate (tree-clean → BLOCKED with the commit/discard
// guidance, the skill-side claim `engine entry gate: dirty → BLOCKED` finally made
// real), then the wave-side gates (plan-graph validate + the three-verb WaveGate)
// and the doc-side gate (Contract.validate over the target doc).
//
// Gate order (the design's pinned sequence, judgeable on every verdict):
//   tree-clean → (wave/plan faces) plan-graph validate → (wave face) WaveGate.vet →
//   (spec/plan faces) Contract.validate → dispatch
// The evidence/read-back gates stay at the dispatch child face (the seam never
// touches the round's produced artifacts — non-pre-flight by design).
//
// The verdict is the single BLOCK carrier: `gate` names the refusing gate, `reason`
// the named refusal row, `message` the CDD_BLOCKED wording (pinned rows), `details`
// the named issue/finding lines the renderer prints, `order` the gates that ran
// (the CLI never re-implements a gate — the seam owns the whole sequence). BLOCK
// wording rides the word table (the capsule station + the preflight rows), never a
// CLI restate.
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { PlanDocType } from "../contract/doc.ts";
import type { DocFs } from "../contract/invariants.ts";
import type { Contract } from "../contract/judge.ts";
import type { DocKey } from "../contract/project.ts";
import type { Words } from "../face/words.ts";
import type { GitClient } from "../infra/git.ts";
import type { TargetType } from "./faces.ts";
import { TaskGraph } from "./graph.ts";
import type { Ledger } from "./ledger.ts";
import { WaveGate } from "./wave.ts";

/** The named gates the seam composes — the run evidence + the blocking gate label. */
export type PreFlightGateName = "tree-clean" | "plan-graph" | "wave" | "doc-contract";

/** The named refusal rows — the BLOCK reason the CDD_BLOCKED wording fills. */
export type PreFlightReason =
  | "dirty-tree"
  | "plan-graph"
  | "split"
  | "wrong-phase"
  | "doc-contract";

/** One pre-flight verdict — the single BLOCK carrier of the dispatch gates. */
export interface PreFlightVerdict {
  /** Whether the dispatch is approved (the gates passed). */
  ok: boolean;
  /** The refusing gate (absent when ok — no gate blocked). */
  gate?: PreFlightGateName;
  /** The named refusal row (absent when ok). */
  reason?: PreFlightReason;
  /** The rendered BLOCK wording — the CDD_BLOCKED channel carries it (word-table
   *  rows + the WaveGate verdict's own filled rows). */
  message?: string;
  /** The named issue/finding lines the renderer prints under the message. */
  details?: readonly string[];
  /** The gates that ran, in order — the judgeable 门序 (tree-clean → plan-graph →
   *  wave → doc-contract, per the face's applicable set). */
  order: readonly PreFlightGateName[];
}

/** The doc-contract target of a spec/plan dispatch. */
export interface PreFlightDoc {
  /** The target doc type's registry key. */
  docKey: DocKey;
  /** The target doc's path (the lifecycle's audit path). */
  path: string;
}

/** One dispatch's pre-flight inputs — the facts the seam judges. */
export interface PreFlightContext {
  /** The requested dispatch verb (the three work verbs — the WaveGate's verb). */
  verb: "implement" | "review" | "fix";
  /** The dispatch's target type (wave / branch / spec / plan). */
  type: TargetType;
  /** The repo root the tree-clean gate reads. */
  repoRoot: string;
  /** The repo-relative engine workspace root (e.g. `.kairos/cdd`) — the clean-tree
   *  gate ignores everything under it: the engine's run artifacts are engine-owned,
   *  never "uncommitted user work" (a consumer repo without a `.kairos` gitignore
   *  must not self-BLOCK on the workspace the scene itself wrote). */
  workspaceRoot: string;
  /** The plan text (the wave/plan faces' plan-graph gate input; null otherwise). */
  planText: string | null;
  /** The requested `--tasks` group (the wave face's WaveGate input). */
  tasks: ReadonlySet<number> | null;
  /** The session ledger (the wave face's WaveGate input). */
  ledger: Ledger | null;
  /** The doc-contract target of a spec/plan dispatch (null on the other faces). */
  doc: PreFlightDoc | null;
}

/**
 * PreFlight — the single pre-flight seam of the work dispatch. One `vet` call runs
 * the whole gate sequence in the pinned order and returns the verdict the CLI
 * renders (or approves): the seam owns the gates, the CLI only orchestrates the
 * call + the render — zero second implementation on the CLI face.
 */
export class PreFlight {
  /** The git seam the tree-clean gate reads. */
  readonly #git: GitClient;
  /** The doc-contract coordinator the doc faces judge through. */
  readonly #contract: Contract;
  /** The three-verb unified wave gate the wave face consults. */
  readonly #waveGate: WaveGate;
  /** The word table the BLOCK wording rides. */
  readonly #words: Words;
  /** The filesystem seam the doc-contract gate reads (defaults to node:fs). */
  readonly #fs: DocFs;

  constructor(opts: {
    git: GitClient;
    contract: Contract;
    words: Words;
    waveGate?: WaveGate;
    fs?: DocFs;
  }) {
    this.#git = opts.git;
    this.#contract = opts.contract;
    this.#words = opts.words;
    this.#waveGate = opts.waveGate ?? new WaveGate();
    this.#fs = opts.fs ?? new NodeFs();
  }

  /** vet(ctx) — the single seam call: tree-clean → plan-graph → wave → doc-contract.
   *  The first refused gate owns the verdict; the gates that ran precede it (the
   *  judgeable 门序). */
  async vet(ctx: PreFlightContext): Promise<PreFlightVerdict> {
    const gates: PreFlightGateName[] = [];
    // 1. tree-clean — the hard gate all three verbs share: a dirty working tree
    //    BLOCKs BEFORE any other judgment (review 基准 = 已提交状态). isClean is
    //    fail-open-false (a non-repo counts dirty — the CDD flow needs git).
    gates.push("tree-clean");
    if (!(await this.#git.isClean(ctx.repoRoot, ctx.workspaceRoot))) {
      return {
        ok: false,
        gate: "tree-clean",
        reason: "dirty-tree",
        message: this.#words.preflightWords().dirtyTree,
        order: gates,
      };
    }
    // 2. plan-graph — the wave/plan faces' structural gate: the plan's DependsOn
    //    graph must validate (missing-edge / missing-id / self-loop / cycle) before
    //    the dispatch reads it. The task-loss class dies here, never silently.
    let graph: TaskGraph | null = null;
    if ((ctx.type === "wave" || ctx.type === "plan") && ctx.planText !== null) {
      gates.push("plan-graph");
      graph = new TaskGraph(new PlanDocType("plan").parse(ctx.planText.split("\n")));
      const issues = graph.validate();
      if (issues.length > 0) {
        return {
          ok: false,
          gate: "plan-graph",
          reason: "plan-graph",
          message: this.#words.preflightWords().planGraph.replace("{count}", String(issues.length)),
          details: issues.map((issue) => `${issue.kind}@T${issue.task}: ${issue.message}`),
          order: gates,
        };
      }
    }
    // 3. wave — the three-verb unified wave gate (the task face's phase authority):
    //    the requested `--tasks` must be EXACTLY the derived open wave at the verb's
    //    phase. The refusal wording rides the wave-gate word-table rows.
    if (ctx.type === "wave" && graph !== null && ctx.ledger !== null && ctx.tasks !== null) {
      gates.push("wave");
      const verdict = this.#waveGate.vet(ctx.tasks, ctx.verb, graph, ctx.ledger, this.#words);
      if (!verdict.ok) {
        return {
          ok: false,
          gate: "wave",
          reason: verdict.reason,
          message: verdict.message ?? "",
          order: gates,
        };
      }
    }
    // 4. doc-contract — the doc faces' structural gate: the target doc must pass
    //    Contract.validate (the interpreter's single judgment entry) before its
    //    review/fix round dispatches. An unreadable doc carries no judgment (no
    //    fabricated findings from an absent surface).
    if (ctx.type === "spec" || ctx.type === "plan") {
      gates.push("doc-contract");
      const doc = ctx.doc;
      const content = doc === null ? null : this.#fs.read(doc.path);
      if (content !== null && doc !== null) {
        const findings = this.#contract.validate({
          docKey: doc.docKey,
          path: doc.path,
          content,
          root: ctx.repoRoot,
          fs: this.#fs,
        });
        if (findings.length > 0) {
          return {
            ok: false,
            gate: "doc-contract",
            reason: "doc-contract",
            message: this.#words.preflightWords().docContract,
            details: findings.map(
              (finding) => `${finding.kind}@${finding.field}: ${finding.message}`,
            ),
            order: gates,
          };
        }
      }
    }
    return { ok: true, order: gates };
  }
}

/** The node:fs default — the production seam for the doc-contract's file reads. */
class NodeFs implements DocFs {
  read(p: string): string | null {
    try {
      return readFileSync(p, "utf8");
    } catch {
      return null;
    }
  }
  exists(p: string): boolean {
    return existsSync(p);
  }
  list(p: string): readonly string[] {
    try {
      return readdirSync(p);
    } catch {
      return [];
    }
  }
}
