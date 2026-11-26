// packages/cdd-engine/src/docs/judging/judge.ts
// The judgment coordinator — the ONE entry for structural judgment. It builds the parse
// context through the doc-type parsers (a pure parse), composes the per-doc-type strategy set
// from the declared rule table, runs every strategy in order and aggregates the findings.
//
// Judgment dispatch is a record index over the declared strategy set — zero switch-case and
// zero hand-written judgment branch in this module: the strategy family judges, the
// coordinator assembles.
//
// Three facts this file is the single home of:
//   · the tier stamping point — a strategy hands back DRAFTS and the declaration says what a
//     hit costs; `stamped` is the only join;
//   · the closed-document exemption — a proven-closed document skips exactly the rows that
//     carry `skipWhenClosed`, and nothing else;
//   · the two entry shapes — `judge` (doc scope) and `judgeLedger` (doc + ledger facts). A doc
//     judgment never runs a ledger rule, and the ledger facts never ride the context.
//
// Two findings sit OUTSIDE the declared rule set, and both exist so a verdict can never be a
// silent "clean":
//   · `doc-syntax` — the parse face's own rejection (`DocSyntaxError`), materialized from the
//     context construction alone;
//   · `rule-fault` — one rule threw. The rules that already answered keep their findings and
//     the broken rule refuses under its own name, so one fault neither discards a verdict nor
//     lets the rest of the table go unrun.
//
// The strategy composition is DECLARED, not hard-coded: `policy()` walks the rule table's
// doc-scope rows and instantiates each row's factory, and `ruleRows()` answers the SAME table
// this instance judged through — one list, one source, zero re-copy.
//
// Module-level exports are the types and the class — zero behaviour-carrying bare functions.

import type { RepoPath } from "../../env/paths/root.ts";
import { MarkdownTree } from "../grammar/markdown-tree.ts";
import { TaskBlocks } from "../grammar/task-blocks.ts";
import { DocSyntaxError, docTypeParsers, type ParsedDoc } from "../identity/doc-parse.ts";
import { Projector } from "../identity/project.ts";
import { declaredRegistries } from "../identity/registry.ts";
import { RowSource, type Translator } from "../identity/translate.ts";
import { DOC_TYPE_VALUES, type DocType } from "../identity/types.ts";
import type { DocumentIndex, DocumentWorld } from "./closure.ts";
import { DocumentIndex as Index } from "./closure.ts";
import type {
  Finding,
  FindingDraft,
  InjectedGraphIssue,
  Invariant,
  JudgeContext,
  LedgerFacts,
  LedgerRule,
} from "./invariants.ts";
import { type DocRuleDeclaration, RULE_REGISTRY, type RuleDeclaration } from "./rules.ts";
import { SelectorEngine } from "./selectors.ts";

/** The judgment input — the document's identity, its bytes and the injected graph facts. */
export interface JudgeInput {
  /** The doc-type record key of the document under judgment. */
  readonly docKey: DocType;
  /** The document's repo-relative coordinate (message attribution + the doc's own dir). */
  readonly path: RepoPath;
  /** The document's raw content. */
  readonly content: string;
  /** The dispatch phase id — enables the phase-registration check. */
  readonly phaseId?: string;
  /** The plan's topological layers, injected by the caller — the graph's `batches()` is the
   *  ONE derivation authority. Absent → the layer-reading rule yields zero findings. */
  readonly taskLayers?: readonly (readonly number[])[];
  /** The plan's edge-validation issues, injected by the caller, together with the ONE
   *  rendered detail line. Absent → the rule yields zero findings. */
  readonly graphIssues?: readonly InjectedGraphIssue[];
}

/** One declared rule bound to the strategy its factory built — the pair the doc-scope
 *  composition walks, so "which strategy ran" and "which declaration stamped it" can never
 *  come apart (one list, one pass). */
export interface DocRuleBinding {
  readonly declaration: DocRuleDeclaration;
  readonly strategy: Invariant;
}

/** The coordinator's construction facts: the rule table it judges through (the injection
 *  seam), the recognition table its row source canonicalizes with, and the document world
 *  every text read goes through. */
export interface JudgeOptions {
  /** The rule table — `RULE_REGISTRY` in production, a small declared set in a test. */
  readonly registry?: readonly RuleDeclaration[];
  /** The canonicalize seam — the word table's locale rows in production. */
  readonly translator: Translator;
  /** The document world — `env/workspace` behind the injected read faces. */
  readonly world: DocumentWorld;
}

/**
 * Judge — the coordinator. Invariant: a document's verdict is the ordered product of the
 * declared rule rows applicable to its type, each stamped by its own declaration and each
 * exempted from skip only by a proven closure — so no caller can add, reorder or silence a
 * judgment without changing the table.
 */
export class Judge {
  /** The per-doc-type policy sets — the declaration-derived doc-scope strategy family, each
   *  entry carrying BOTH the strategy and the declaration that tiered it. */
  readonly #strategies: Record<DocType, readonly DocRuleBinding[]>;
  /** The rule table this instance judged through, held so `ruleRows()` and the ledger
   *  judgment read the SAME list the doc policy did. */
  readonly #registry: readonly RuleDeclaration[];
  /** The projection carrier — the derived parse / skeleton faces the judgment reads. */
  readonly #projector = new Projector(declaredRegistries);
  /** The canonicalize seam of every judgment over this instance. */
  readonly #translator: Translator;
  /** The document world every text read goes through. */
  readonly #world: DocumentWorld;
  /** The document index over that world — one construction per instance, so the slug and
   *  doc-type relation a judgment reads is the same one its closure read saw. */
  readonly #index: DocumentIndex;

  constructor(opts: JudgeOptions) {
    this.#registry = opts.registry ?? RULE_REGISTRY;
    this.#strategies = Judge.policy(this.#registry);
    this.#translator = opts.translator;
    this.#world = opts.world;
    this.#index = new Index(opts.world.documents(), opts.world.complete());
  }

  /** The document index this instance judges through — the closure reading and the `checked:`
   *  yield line share it, so a document's identity is resolved once. */
  get index(): DocumentIndex {
    return this.#index;
  }

  /** The document world this instance reads through — same reason. */
  get world(): DocumentWorld {
    return this.#world;
  }

  /** The declared doc-scope composition — derived from the injected table (only
   *  `scope: "doc"` rows: a doc judgment never runs a ledger rule). One strategy instance per
   *  row per construction, handed back PAIRED with its own declaration so the tier and the
   *  closed-document exemption travel with the strategy instead of being looked up twice. */
  static policy(registry: readonly RuleDeclaration[]): Record<DocType, readonly DocRuleBinding[]> {
    const declarations = registry.filter(
      (declaration): declaration is DocRuleDeclaration => declaration.scope === "doc",
    );
    const policy = {} as Record<DocType, readonly DocRuleBinding[]>;
    for (const key of DOC_TYPE_VALUES) {
      policy[key] = declarations
        .filter(
          (declaration) => declaration.docTypes === "all" || declaration.docTypes.includes(key),
        )
        .map((declaration) => ({ declaration, strategy: declaration.create() }));
    }
    return policy;
  }

  /** The ONE tier-stamping point for a DECLARED rule: a strategy hands back drafts, the
   *  declaration says what a hit costs, and this joins them. */
  static stamped(
    drafts: readonly FindingDraft[],
    declaration: RuleDeclaration,
  ): readonly Finding[] {
    return drafts.map((draft) => ({ ...draft, severity: declaration.severity }));
  }

  /** The checked-list data face — every declaration row (both scopes) of THIS instance's
   *  table, in table order. The pre-flight renders these rows; it never writes a second list. */
  ruleRows(): readonly RuleDeclaration[] {
    return this.#registry;
  }

  /** The assembled judgment context — the shared split / parse / project seam of both entries
   *  (one context construction, one canonicalize pass). It is public because the reference
   *  lint reads the SAME context the judgment just built: one parse, two faces. */
  contextOf(input: JudgeInput): JudgeContext {
    // The row source resolves the raw front-matter head, then canonicalizes the body ONCE:
    // the line face, the tree face and the parse face all read the same normalized bytes.
    const { head, text } = new RowSource(this.#translator).read(input.content);
    const tree = MarkdownTree.parse(text);
    const blocks = TaskBlocks.of(tree);
    const parsed: ParsedDoc = docTypeParsers[input.docKey].parse(tree, head);
    return {
      docKey: input.docKey,
      parsed,
      head,
      path: input.path,
      slices: this.#projector.slices()[input.docKey],
      shape: this.#projector.shape()[input.docKey],
      skeleton: this.#projector.skeleton()[input.docKey],
      registries: declaredRegistries,
      ...(input.phaseId === undefined ? {} : { phaseId: input.phaseId }),
      tree,
      selector: new SelectorEngine(tree, blocks),
      text,
      translator: this.#translator,
      world: this.#world,
      index: this.#index,
      ...(input.taskLayers === undefined ? {} : { taskLayers: input.taskLayers }),
      ...(input.graphIssues === undefined ? {} : { graphIssues: input.graphIssues }),
    };
  }

  /** The document-syntax face of a judgment — the parse face throws a typed
   *  `DocSyntaxError`, and the judgment materializes exactly ONE finding bound to the judged
   *  path (never a registered rule, never a new gate). The tier stamps itself because this
   *  finding has no declaration: the parse face has always been a refusal, so it reads
   *  `block`. Any OTHER throw from the same step is a programming break and rethrows — the
   *  context construction is the only caught step, never a strategy. */
  static #syntaxFinding(input: JudgeInput, error: unknown): Finding {
    if (!(error instanceof DocSyntaxError)) throw error;
    return {
      path: input.path,
      field: error.field,
      message: error.message,
      fix: error.fix,
      kind: "doc-syntax",
      severity: "block",
    };
  }

  /** The coordinator's own attribution when one rule throws — the verdict is UNKNOWN, so it
   *  refuses under the broken rule's id instead of reading as clean. The findings already
   *  stamped stay in the answer, and the loop continues: one fault never silences the rest of
   *  the table. */
  static #faultFinding(input: JudgeInput, declaration: RuleDeclaration, error: unknown): Finding {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      path: input.path,
      field: declaration.id,
      message: `the rule ${declaration.id} broke while judging this document: ${detail} — the verdict is unknown, not clean`,
      fix: `repair the rule ${declaration.id} (its own pin names the fixture that broke); every finding of this judgment is untrusted until it runs`,
      kind: "rule-fault",
      severity: "block",
    };
  }

  /** Run one declared rule — the ONE containment seam both entries share. A `DocSyntaxError`
   *  escaping a strategy is a programming break (the parse face's rejection is materialized at
   *  the context construction, where it belongs) and rethrows; every other throw becomes one
   *  `rule-fault` finding that names the declaration. */
  static #contain(
    input: JudgeInput,
    declaration: RuleDeclaration,
    findings: Finding[],
    run: () => readonly FindingDraft[],
  ): void {
    try {
      findings.push(...Judge.stamped(run(), declaration));
    } catch (error) {
      if (error instanceof DocSyntaxError) throw error;
      findings.push(Judge.#faultFinding(input, declaration, error));
    }
  }

  /** judge(input, closed) — the doc-scope entry. `closed` is the caller's proven-closure fact:
   *  a closed document exempts every declaration carrying `skipWhenClosed`, and only those.
   *  The context construction is the ONE caught step (its `DocSyntaxError` becomes one
   *  `doc-syntax` finding); each strategy is then judged independently, so a rule that throws
   *  refuses under its own name without discarding the findings around it. */
  judge(input: JudgeInput, closed = false): readonly Finding[] {
    let context: JudgeContext;
    try {
      context = this.contextOf(input);
    } catch (error) {
      return [Judge.#syntaxFinding(input, error)];
    }
    const findings: Finding[] = [];
    for (const binding of this.#strategies[input.docKey]) {
      if (closed && binding.declaration.skipWhenClosed) continue;
      Judge.#contain(input, binding.declaration, findings, () =>
        binding.strategy.evaluate(context),
      );
    }
    return findings;
  }

  /** judgeLedger(input, ledger) — the ledger-scope entry: the plan document under judgment
   *  plus the ledger fact bundle, judged by every `scope: "ledger"` declaration applicable to
   *  the input's doc type. Two arguments, one judgment — the doc-scope rules never run here
   *  (and vice versa); the containment seam is the same one. */
  judgeLedger(input: JudgeInput, ledger: LedgerFacts): readonly Finding[] {
    let context: JudgeContext;
    try {
      context = this.contextOf(input);
    } catch (error) {
      return [Judge.#syntaxFinding(input, error)];
    }
    const findings: Finding[] = [];
    for (const declaration of this.#registry) {
      if (declaration.scope !== "ledger") continue;
      if (declaration.docTypes !== "all" && !declaration.docTypes.includes(input.docKey)) {
        continue;
      }
      const rule: LedgerRule = declaration.create();
      Judge.#contain(input, declaration, findings, () => rule.evaluate(context, ledger));
    }
    return findings;
  }
}
