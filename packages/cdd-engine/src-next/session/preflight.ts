// packages/cdd-engine/src-next/session/preflight.ts
// P4.1 T1 — the lifecycle pre-flight seam (design spec §1): the dispatch gates
// converge into ONE single-entry gate a work command consults before ANY child
// dispatch — the clean-tree hard gate (tree-clean → BLOCKED with the commit/discard
// guidance, the skill-side claim `engine entry gate: dirty → BLOCKED` finally made
// real), then the wave-side gates (graph validate + the three-verb WaveGate)
// and the doc-side gate (Contract.validate over the target doc).
//
// Gate order (the design's pinned sequence, judgeable on every verdict):
//   tree-clean → (wave/plan faces) graph validate → (wave face) WaveGate.vet →
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
import { FrontMatterExtractor } from "../contract/frontmatter.ts";
import type { DocFs } from "../contract/invariants.ts";
import type { Contract } from "../contract/judge.ts";
import type { DocKey } from "../contract/project.ts";
import type { Words } from "../face/words.ts";
import type { GitClient } from "../infra/git.ts";
import { type RepoPath, RepoRoot } from "../infra/root.ts";
import { SlugIndex } from "../infra/slug-index.ts";
import type { TargetType } from "./faces.ts";
import { TaskGraph } from "./graph.ts";
import type { Ledger } from "./ledger.ts";
import { WaveGate } from "./wave.ts";

/** The named gates the seam composes — the run evidence + the blocking gate label. */
export type PreFlightGateName = "tree-clean" | "graph" | "wave" | "doc-contract";

/** The named refusal rows — the BLOCK reason the CDD_BLOCKED wording fills. */
export type PreFlightReason = "dirty-tree" | "graph" | "split" | "wrong-phase" | "doc-contract";

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
  /** The gates that ran, in order — the judgeable order (tree-clean → graph →
   *  wave → doc-contract, per the face's applicable set). */
  order: readonly PreFlightGateName[];
}

/** The doc-contract target of a spec/plan dispatch. */
export interface PreFlightDoc {
  /** The target doc type's registry key — read from the doc's front-matter
   *  `doc-type:` key (spec §12 · D34; both the spec and the plan faces key by
   *  the head key, zero command-type carve-out).
   *  null when a present doc carries no key — the seam BLOCKs (zero
   *  filename-suffix fallback, one declaration reading face `BoardView.readDocType`). */
  docKey: DocKey | null;
  /** The target doc's path — the branded repoRoot-relative `RepoPath` (T4 §2.2: a
   *  bare `string` never reaches this read face; the caller feeds the funnel-shaped
   *  relative value). The seam erases it to the absolute syscall form through its
   *  OWN `RepoRoot(ctx.repoRoot)` just before the read — the brand is REAL (the
   *  absolute state is unrepresentable as a `RepoPath`), the same shape as
   *  `artifacts.readText(node, root, file: RepoPath)`). */
  path: RepoPath;
}

/** One dispatch's pre-flight inputs — the facts the seam judges. */
export interface PreFlightContext {
  /** The requested dispatch verb (the three work verbs — the WaveGate's verb). */
  verb: "implement" | "review" | "fix";
  /** The dispatch's target type (wave / branch / spec / plan). */
  type: TargetType;
  /** The repo root the tree-clean gate reads. */
  repoRoot: string;
  /** The plan text (the wave/plan faces' graph gate input; null otherwise). */
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

  /** vet(ctx) — the single seam call: tree-clean → graph → wave → doc-contract.
   *  The first refused gate owns the verdict; the gates that ran precede it (the
   *  judgeable order). */
  async vet(ctx: PreFlightContext): Promise<PreFlightVerdict> {
    const gates: PreFlightGateName[] = [];
    // 1. tree-clean — the hard gate all three verbs share: a dirty working tree
    //    BLOCKs BEFORE any other judgment (review's baseline = the committed state). isClean is
    //    fail-open-false (a non-repo counts dirty — the CDD flow needs git).
    gates.push("tree-clean");
    if (!(await this.#git.isClean(ctx.repoRoot))) {
      return {
        ok: false,
        gate: "tree-clean",
        reason: "dirty-tree",
        message: this.#words.preflightWords().dirtyTree,
        order: gates,
      };
    }
    // 2. graph — the wave/plan faces' structural gate: the plan's DependsOn
    //    graph must validate (missing-edge / missing-id / self-loop / cycle) before
    //    the dispatch reads it. The task-loss class dies here, never silently.
    let graph: TaskGraph | null = null;
    if ((ctx.type === "wave" || ctx.type === "plan") && ctx.planText !== null) {
      gates.push("graph");
      graph = new TaskGraph(new PlanDocType("plan").parse(ctx.planText.split("\n")));
      const issues = graph.validate();
      if (issues.length > 0) {
        return {
          ok: false,
          gate: "graph",
          reason: "graph",
          message: this.#words.preflightWords().graph.replace("{count}", String(issues.length)),
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
    //    fabricated findings from an absent surface). A PRESENT doc carrying no
    //    `doc-type:` key BLOCKs (spec §12 · D34: the declared type is
    //    the one reading face, zero filename-suffix fallback).
    if (ctx.type === "spec" || ctx.type === "plan") {
      gates.push("doc-contract");
      const doc = ctx.doc;
      // The relative `RepoPath` erases to the absolute syscall form through the ONE
      // value object (the seam's OWN `RepoRoot(ctx.repoRoot)`) just before the read.
      const docAbsolute = doc === null ? null : new RepoRoot(ctx.repoRoot).resolve(doc.path);
      const content = docAbsolute === null ? null : this.#fs.read(docAbsolute);
      if (content !== null && doc !== null && docAbsolute !== null) {
        // D1 (position-carrying error): a front-matter block the `yaml` engine cannot parse is
        // BLOCKed with the REAL failure (line · column · reason) BEFORE the
        // doc-type judgment — an unparseable head also reads no doc-type, so the
        // parse check must precede the missing-key check (the misread fix: a
        // `[`-led author line reports "invalid YAML", never "no doc-type").
        const { head } = FrontMatterExtractor.split(content);
        const parseError = head.parseError;
        if (parseError !== null) {
          return {
            ok: false,
            gate: "doc-contract",
            reason: "doc-contract",
            message: this.#words
              .routeWord("frontmatterParse")
              .replace("{reason}", parseError.reason)
              .replace("{line}", String(parseError.line))
              .replace("{column}", String(parseError.column))
              .replace("{source}", parseError.source),
            order: gates,
          };
        }
        if (doc.docKey === null) {
          return {
            ok: false,
            gate: "doc-contract",
            reason: "doc-contract",
            message: this.#words.routeWord("docType"),
            order: gates,
          };
        }
        // The identity gates (spec §2.1/§2.2) — same face, same carrier: the
        // workspace key is the declared `slug:`, and the index's uniqueness
        // judgment is the SAME one the board renders (one fact, two carriers).
        const slug = head.slug;
        if (slug === null) {
          return {
            ok: false,
            gate: "doc-contract",
            reason: "doc-contract",
            message: this.#words.routeWord("slugMissing"),
            order: gates,
          };
        }
        if (!SlugIndex.isLegalSlug(slug)) {
          return {
            ok: false,
            gate: "doc-contract",
            reason: "doc-contract",
            message: this.#words.routeWord("slugInvalid").replace("{slug}", slug),
            order: gates,
          };
        }
        const index = SlugIndex.build(ctx.repoRoot, this.#fs);
        const entry = index.entryAt(doc.path);
        const duplicated =
          entry !== null && entry.slug === slug && index.duplicatedRolesOf(slug).length > 0;
        if (duplicated) {
          return {
            ok: false,
            gate: "doc-contract",
            reason: "doc-contract",
            message: this.#words.routeWord("slugDuplicated").replace("{slug}", slug),
            order: gates,
          };
        }
        const findings = this.#contract.validate({
          docKey: doc.docKey,
          path: docAbsolute,
          content,
          root: ctx.repoRoot,
          // The SAME index the identity gates above read — one scan per dispatch,
          // and the contract's chain / slug-ref lookups judge the identical facts.
          slugIndex: index,
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
