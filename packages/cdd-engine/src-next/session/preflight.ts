// packages/cdd-engine/src-next/session/preflight.ts
// P4.1 T1 — the lifecycle pre-flight seam (design spec §1): the dispatch gates
// converge into ONE single-entry gate a work command consults before ANY child
// dispatch — the clean-tree hard gate (tree-clean → BLOCKED with the commit/discard
// guidance, the skill-side claim `engine entry gate: dirty → BLOCKED` finally made
// real), then the plan/ledger structure gate (`plan-ledger`, P21 §3.1/§6.4), the
// wave-side gates (graph validate + the three-verb WaveGate) and the doc-side gate
// (Contract.validate over the target doc).
//
// Gate order (the design's pinned sequence, judgeable on every verdict):
//   tree-clean → graph → plan-ledger → (wave face) WaveGate.vet →
//   (spec/plan faces) Contract.validate → dispatch
// The evidence/read-back gates stay at the dispatch child face (the seam never
// touches the round's produced artifacts — non-pre-flight by design).
//
// The verdict is the single BLOCK carrier: `gate` names the refusing gate, `reason`
// the named refusal row, `message` the CDD_BLOCKED wording (pinned rows), `details`
// the named issue/finding lines the renderer prints, `order` the gates that ran
// (the CLI never re-implements a gate — the seam owns the whole sequence) and
// `checked` the per-rule checked list (P21 §3.4) — derived from the SAME rule
// declaration surface the policy composition walks, so "which rule ran" and "what it
// judged" can never drift apart.
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import { PlanDocType } from "../contract/doc.ts";
import { FrontMatterExtractor } from "../contract/frontmatter.ts";
import { type DocFs, type Finding, LedgerTaskSetRule, NodeFs } from "../contract/invariants.ts";
import { Contract, type ContractInput, type LedgerFacts } from "../contract/judge.ts";
import type { DocKey } from "../contract/project.ts";
import type { Words } from "../face/words.ts";
import type { GitClient } from "../infra/git.ts";
import { type RepoPath, RepoRoot } from "../infra/root.ts";
import { SlugIndex } from "../infra/slug-index.ts";
import type { TargetType } from "./faces.ts";
import { TaskGraph } from "./graph.ts";
import type { Ledger, ProgressData } from "./ledger.ts";
import { WaveGate, type WaveGateReason } from "./wave.ts";

/** The named gates the seam composes — the run evidence + the blocking gate label. */
export type PreFlightGateName =
  | "tree-clean"
  | "in-flight"
  | "graph"
  | "plan-ledger"
  | "wave"
  | "doc-contract";

/** The named refusal rows — the BLOCK reason the CDD_BLOCKED wording fills (the
 *  wave-gate rows derive from `WaveGateReason` — one declaration, never a re-list).
 *  Refusals exist only on the failure face (`ok: true` carries no `reason`), so the
 *  enum has zero dead values: "the plan leads the ledger" is a `checked` info row, and
 *  a missing ledger fact bundle is a `checked` skipped row — neither is a refusal. */
export type PreFlightReason = "dirty-tree" | "graph" | WaveGateReason | "doc-contract";

/** The doc-scope judgment outcome of one dispatch — what the checked list renders. */
type DocOutcome =
  | { readonly kind: "judged"; readonly findings: readonly Finding[] }
  | { readonly kind: "no-doc-target" }
  | { readonly kind: "unreadable" }
  | { readonly kind: "not-judged" };

/** The ledger-scope judgment outcome of one dispatch. */
type LedgerOutcome =
  | { readonly kind: "judged"; readonly findings: readonly Finding[] }
  | { readonly kind: "no-ledger-facts" };

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
   *  plan-ledger → wave → doc-contract, per the face's applicable set). */
  order: readonly PreFlightGateName[];
  /** The checked face — one row per gate (`${gate}`) and per declared rule
   *  (`${ruleId}: ${passed|failed|skipped (reason)|info (hint)}`), derived from the
   *  SAME rule declaration surface the strategy composition walks. */
  checked: readonly string[];
}

/** The doc-contract target of a spec/plan dispatch. */
export interface PreFlightDoc {
  /** The target doc type's registry key — read from the doc's front-matter
   *  `doc-type:` key (spec §12 · D34; both the spec and the plan faces key by
   *  the head key, zero command-type carve-out).
   *  null when a present doc carries no key OR carries a value outside the
   *  declared domain — the seam BLOCKs either way, with a distinct word per
   *  shape (zero filename-suffix fallback, one declaration reading face
   *  `BoardView.readDocType`). */
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

  /** vet(ctx) — the single seam call: tree-clean → graph → plan-ledger → wave →
   *  doc-contract. The first refused gate owns the verdict; the gates that ran
   *  precede it (the judgeable order). */
  async vet(ctx: PreFlightContext): Promise<PreFlightVerdict> {
    const gates: PreFlightGateName[] = [];
    const checked: string[] = [];
    // 1. tree-clean — the hard gate all three verbs share.
    gates.push("tree-clean");
    checked.push("tree-clean");
    if (!(await this.#git.isClean(ctx.repoRoot))) {
      return this.#refusal(
        {
          ok: false,
          gate: "tree-clean",
          reason: "dirty-tree",
          message: this.#words.preflightWords().dirtyTree,
        },
        gates,
        checked,
        this.#docOutcomeOf(ctx, null),
        { kind: "no-ledger-facts" },
      );
    }
    // 2. graph — the wave/plan faces' structural gate.
    let graph: TaskGraph | null = null;
    if ((ctx.type === "wave" || ctx.type === "plan") && ctx.planText !== null) {
      gates.push("graph");
      checked.push("graph");
      graph = new TaskGraph(new PlanDocType("plan").parse(ctx.planText.split("\n")));
      const issues = graph.validate();
      if (issues.length > 0) {
        return this.#refusal(
          {
            ok: false,
            gate: "graph",
            reason: "graph",
            message: this.#words.preflightWords().graph.replace("{count}", String(issues.length)),
            details: issues.map((issue) => `${issue.kind}@T${issue.task}: ${issue.message}`),
          },
          gates,
          checked,
          this.#docOutcomeOf(ctx, null),
          { kind: "no-ledger-facts" },
        );
      }
    }
    // 3. plan-ledger — the ledger-scope rules (P21 §3.1/§6.4). Plan / wave / branch
    //    dispatches run it; the doc-scope rules never do (two scopes, two entries).
    //    A missing fact bundle is NOT a refusal: the rows render `skipped`.
    let ledgerOutcome: LedgerOutcome = { kind: "no-ledger-facts" };
    let ledgerInput: ContractInput | null = null;
    if (ctx.type === "plan" || ctx.type === "wave" || ctx.type === "branch") {
      gates.push("plan-ledger");
      checked.push("plan-ledger");
      const facts = this.#ledgerFactsOf(ctx, graph);
      if (facts !== null) {
        ledgerInput = this.#ledgerInputOf(ctx);
        const findings = this.#contract.validateLedger(ledgerInput, facts);
        ledgerOutcome = { kind: "judged", findings };
        const ahead = LedgerTaskSetRule.planAhead(facts);
        if (ahead > 0) {
          checked.push(this.#words.checkedWords().planAhead.replace("{count}", String(ahead)));
        }
        if (findings.length > 0) {
          return this.#refusal(
            {
              ok: false,
              gate: "plan-ledger",
              reason: "doc-contract",
              message: this.#words.preflightWords().planLedger,
              details: findings.map(
                (finding) => `${finding.kind}@${finding.field}: ${finding.message}`,
              ),
            },
            gates,
            checked,
            this.#docOutcomeOf(ctx, null),
            ledgerOutcome,
          );
        }
      }
    }
    // 4. wave — the three-verb unified wave gate.
    if (ctx.type === "wave" && graph !== null && ctx.ledger !== null && ctx.tasks !== null) {
      gates.push("wave");
      checked.push("wave");
      const verdict = this.#waveGate.vet(ctx.tasks, ctx.verb, graph, ctx.ledger, this.#words);
      if (!verdict.ok) {
        return this.#refusal(
          {
            ok: false,
            gate: "wave",
            reason: verdict.reason,
            message: verdict.message ?? "",
          },
          gates,
          checked,
          this.#docOutcomeOf(ctx, null),
          ledgerOutcome,
        );
      }
    }
    // 5. doc-contract — the doc faces' structural gate (the doc-scope rules).
    let docOutcome: DocOutcome = this.#docOutcomeOf(ctx, null);
    if (ctx.type === "spec" || ctx.type === "plan") {
      gates.push("doc-contract");
      checked.push("doc-contract");
      const doc = ctx.doc;
      const docAbsolute = doc === null ? null : new RepoRoot(ctx.repoRoot).resolve(doc.path);
      const content = docAbsolute === null ? null : this.#fs.read(docAbsolute);
      if (content !== null && doc !== null && docAbsolute !== null) {
        const { head } = FrontMatterExtractor.split(content);
        const parseError = head.parseError;
        if (parseError !== null) {
          return this.#refusal(
            {
              ok: false,
              gate: "doc-contract",
              reason: "doc-contract",
              message: this.#words
                .routeWord("frontmatterParse")
                .replace("{reason}", parseError.reason)
                .replace("{line}", String(parseError.line))
                .replace("{column}", String(parseError.column))
                .replace("{source}", parseError.source),
            },
            gates,
            checked,
            { kind: "not-judged" },
            ledgerOutcome,
          );
        }
        if (doc.docKey === null) {
          const message =
            head.docType === null
              ? this.#words.routeWord("docType")
              : this.#words.docTypeValueWord(head.docType);
          return this.#refusal(
            { ok: false, gate: "doc-contract", reason: "doc-contract", message },
            gates,
            checked,
            { kind: "not-judged" },
            ledgerOutcome,
          );
        }
        const index = SlugIndex.build(ctx.repoRoot, this.#fs);
        const verdict = index.slugVerdict(doc.path, head.slug);
        if (verdict.kind !== "accepted") {
          return this.#refusal(
            {
              ok: false,
              gate: "doc-contract",
              reason: "doc-contract",
              message: this.#words.slugRefusal(verdict),
            },
            gates,
            checked,
            { kind: "not-judged" },
            ledgerOutcome,
          );
        }
        const findings = this.#contract.validate({
          docKey: doc.docKey,
          path: docAbsolute,
          content,
          root: ctx.repoRoot,
          slugIndex: index,
          fs: this.#fs,
        });
        docOutcome = { kind: "judged", findings };
        if (findings.length > 0) {
          return this.#refusal(
            {
              ok: false,
              gate: "doc-contract",
              reason: "doc-contract",
              message: this.#words.preflightWords().docContract,
              details: findings.map(
                (finding) => `${finding.kind}@${finding.field}: ${finding.message}`,
              ),
            },
            gates,
            checked,
            docOutcome,
            ledgerOutcome,
          );
        }
      } else {
        docOutcome = { kind: "unreadable" };
      }
    }
    return {
      ok: true,
      order: gates,
      checked: [...checked, ...this.#ruleRows(docOutcome, ledgerOutcome)],
    };
  }

  /** Assemble the refusal verdict — the gates/checked rows accumulated so far, plus
   *  the per-rule rows of the judgment outcomes reached (one carrier shape). */
  #refusal(
    verdict: Omit<PreFlightVerdict, "order" | "checked">,
    gates: readonly PreFlightGateName[],
    checked: readonly string[],
    doc: DocOutcome,
    ledger: LedgerOutcome,
  ): PreFlightVerdict {
    return {
      ...verdict,
      order: gates,
      checked: [...checked, ...this.#ruleRows(doc, ledger)],
    };
  }

  /** The doc-scope outcome of a dispatch — "no doc target" on the doc-less faces
   *  (wave / branch), "not judged" when the doc-contract gate never ran. */
  #docOutcomeOf(ctx: PreFlightContext, findings: readonly Finding[] | null): DocOutcome {
    if (findings !== null) return { kind: "judged", findings };
    if (ctx.type === "wave" || ctx.type === "branch") return { kind: "no-doc-target" };
    return { kind: "not-judged" };
  }

  /** The checked rows of the rule declaration surface — one line per declaration,
   *  rendered ONCE (a rule crossing two gates never appears twice). */
  #ruleRows(doc: DocOutcome, ledger: LedgerOutcome): string[] {
    const words = this.#words.checkedWords();
    const rows: string[] = [];
    for (const declaration of Contract.ruleRows()) {
      if (declaration.scope === "doc") {
        if (doc.kind === "no-doc-target")
          rows.push(`${declaration.id}: ${words.skippedNoDocTarget}`);
        else if (doc.kind === "not-judged")
          rows.push(`${declaration.id}: ${words.skippedNotJudged}`);
        else if (doc.kind === "unreadable")
          rows.push(`${declaration.id}: ${words.skippedUnreadableDoc}`);
        else
          rows.push(
            `${declaration.id}: ${
              doc.findings.some((finding) => finding.kind === declaration.id)
                ? words.failed
                : words.passed
            }`,
          );
        continue;
      }
      if (ledger.kind === "no-ledger-facts") {
        rows.push(`${declaration.id}: ${words.skippedNoLedgerFacts}`);
      } else {
        rows.push(
          `${declaration.id}: ${
            ledger.findings.some((finding) => finding.kind === declaration.id)
              ? words.failed
              : words.passed
          }`,
        );
      }
    }
    return rows;
  }

  /** The ledger fact bundle of one dispatch — built from the ledger, the plan text
   *  and the plan's topological layers. Null when either fact source is absent
   *  (the gate then renders `skipped (no ledger facts)`). */
  #ledgerFactsOf(ctx: PreFlightContext, graph: TaskGraph | null): LedgerFacts | null {
    const ledger = ctx.ledger;
    if (ledger === null || ctx.planText === null) return null;
    const parsed = new PlanDocType("plan").parse(ctx.planText.split("\n"));
    const planTasks = parsed.taskBlocks.map((block) => block.id);
    const layers = (graph ?? new TaskGraph(parsed)).batches();
    const data = ledger.readProgress();
    const recorded = this.#recordedTasksOf(data);
    const closed = ledger.closedWaves();
    const closedWaves = (data?.waves ?? [])
      .map((row) => this.#taskIdsOf(row.wave))
      .filter((ids) => ids.length > 0 && ids.every((id) => closed.has(id)));
    return {
      planTasks,
      recordedTasks: recorded,
      closedWaves,
      snapshots: [],
      maxRecordedTask: recorded.length > 0 ? Math.max(...recorded) : 0,
      layers,
    };
  }

  /** The task ids the ledger recorded at least one round for (the recorded set of
   *  the plan/ledger agreement rule). Only TASK waves count: a doc/branch line row
   *  (keyed `"plan"` / `"spec"` / `"branch"`) is not a task id. */
  #recordedTasksOf(data: ProgressData | null): readonly number[] {
    const recorded: number[] = [];
    for (const row of data?.waves ?? []) {
      if (!row.rounds) continue;
      const hasRound = Object.values(row.rounds).some((cycles) => cycles.length > 0);
      if (!hasRound) continue;
      recorded.push(...this.#taskIdsOf(row.wave));
    }
    return recorded;
  }

  /** A wave key's task ids — the numeric-only reading (a non-numeric line key yields
   *  no task ids; the ledger rules judge TASK waves, never doc/branch line rows). */
  #taskIdsOf(waveKey: string): readonly number[] {
    const ids: number[] = [];
    for (const part of waveKey.split(",")) {
      const id = Number(part);
      if (Number.isInteger(id) && id > 0) ids.push(id);
    }
    return ids;
  }

  /** The ledger judgment's input document — the plan under judgment (the ledger rules
   *  are declared plan-only; the other facts ride `LedgerFacts`). */
  #ledgerInputOf(ctx: PreFlightContext): ContractInput {
    return {
      docKey: "plan",
      path: ctx.doc?.path ?? "",
      content: ctx.planText ?? "",
      root: ctx.repoRoot,
      fs: this.#fs,
    };
  }
}
