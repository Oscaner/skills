// packages/cdd-engine/src-next/contract/judge.ts
// T4 — the single interpreter's coordinator (design spec §2.1): the Contract
// class's validate() is the ONLY entry for structural judgment. It loads the
// parse context through the doc-type parsers (doc.ts — pure parse), composes the
// per-doc-key invariant strategy set (invariants.ts) as declared data, runs every
// strategy in order, and aggregates the findings. Judgment dispatch is a record
// index over the declared strategy set — zero switch-case, zero hand-written
// judgment branches in this module (the plan's coordinator semantics: the
// polymorphic strategy family judges, the coordinator assembles).

import { Words } from "../face/words.ts";
import type { SlugIndex } from "../infra/slug-index.ts";
import { declaredRegistries } from "./declare.ts";
import { DocSyntaxError, docTypeParsers } from "./doc.ts";
import type {
  DocFs,
  Finding,
  FindingDraft,
  InjectedGraphIssue,
  Invariant,
  JudgeContext,
} from "./invariants.ts";
import { NodeFs } from "./invariants.ts";
import { MarkdownTree } from "./markdown-tree.ts";
import type { DocKey } from "./project.ts";
import { DOC_KEYS, Projector } from "./project.ts";
import {
  type DocRuleDeclaration,
  type LedgerRule,
  RULE_REGISTRY,
  type RuleDeclaration,
} from "./rules.ts";
import { RowSource, Translator } from "./translate.ts";

/** The judgment input — the doc's identity, content and the seam closures. */
export interface ContractInput {
  /** The doc-type record key of the document under judgment. */
  docKey: DocKey;
  /** The document's file path (message attribution + the doc's own dir). */
  path: string;
  /** The document's raw content. */
  content: string;
  /** The workspace/repo root the doc chain resolves against. */
  root: string;
  /** The dispatch phase id — enables the face-④ phase-registration check. */
  phaseId?: string;
  /** The identity index the chain / slug-ref strategies look up through (the
   *  caller's single scan; absent → the strategies build one over `fs`). */
  slugIndex?: SlugIndex;
  /** The filesystem seam (defaults to node:fs). */
  fs?: DocFs;
  /** The plan's topological layers, injected by the caller — `TaskGraph#batches()` is
   *  the ONE derivation authority (the wave-width rule reads them, never a re-derived
   *  batch set). Absent → the layer-reading rules yield zero findings. */
  taskLayers?: readonly (readonly number[])[];
  /** The plan's edge-validation issues, injected by the caller — `TaskGraph#validate()`
   *  is the ONE graph authority, and the issues arrive WITH their rendered detail line
   *  so the `depends-on-cycle` row and the `graph` gate's `details` print one template.
   *  Absent → the rule yields zero findings. */
  graphIssues?: readonly InjectedGraphIssue[];
}

/** The ledger fact bundle — the cross-ledger rules' second judgment input (P21 §3.1).
 *  It rides the dedicated `validateLedger(input, ledger)` entry, never a `ContractInput`
 *  field: one entry, one judgment (a doc judgment never silently runs ledger rules). */
export interface LedgerFacts {
  /** The plan's current task ids (the document under judgment). */
  readonly planTasks: readonly number[];
  /** The task ids the ledger already recorded at least one round for. */
  readonly recordedTasks: readonly number[];
  /** The ledger's CLOSED waves, each as its task-id set (the closure read face). */
  readonly closedWaves: readonly (readonly number[])[];
  /** The ledger's OPEN waves — the wave rows that are not closed yet, each as its
   *  task-id set. `closed-wave-fits-depends-on-layers` reads THESE (a closed wave is
   *  settled history: its layer fit was judged at its own dispatch, and a later plan
   *  edit must not retro-flag a wave that already shipped). */
  readonly openWaves: readonly (readonly number[])[];
  /** The wave rows' `planTasks` snapshots (the append-vs-stall observation, §5.1). */
  readonly snapshots: readonly { readonly wave: string; readonly planTasks: readonly number[] }[];
  /** The plan's topological layers (one task-id set per layer, from `TaskGraph.batches()`)
   *  — the sole input of `closed-wave-fits-depends-on-layers`. */
  readonly layers: readonly (readonly number[])[];
}

/** One declared rule bound to the strategy its factory built — the pair the doc-scope
 *  composition walks, so "which strategy ran" and "which declaration stamped it" can
 *  never come apart (one list, one pass). */
export interface DocRuleBinding {
  readonly declaration: DocRuleDeclaration;
  readonly strategy: Invariant;
}

/**
 * The contract coordinator — the interpreter's single face. One instance; the
 * strategy set is stateless (each strategy reads its judgment data from the
 * context), so construction is cheap and validates compose safely.
 *
 * The P7 structure-plane canonicalize seam (design spec §2.1) + the T6 front-matter
 * delivery seam (§2.2): the Contract self-holds a Translator, and validate()
 * canonicalizes EVERY body line once at the row source — the normalized view the
 * parse face and the tree both read. The split order is RAW-first: the raw
 * content resolves its front-matter head BEFORE any canonicalize (front matter is
 * data — the canonicalize view would silently rewrite registered Chinese aliases
 * inside header values), then the post-fence body lines canonicalize and the SAME
 * typed head rides into parse(lines, head). Every valuePattern judgment face
 * (presence occurrenceNodes · domain carrierNodes · section-scoped · crosslink)
 * matches the view, so the legacy Chinese charter
 * markers (the doc-arch decision-group / upstream-endorsements leaves) match their
 * English canonical element patterns through the recognition face — never a second
 * hand-written zh pattern. The view is never written back: the source document
 * stays byte-identical and the original lines remain in input.content.
 *
 * The strategy composition is DECLARED, not hard-coded (P21 §3.1): `policy()` walks
 * the rule declaration surface's doc-scope rows and instantiates each row's factory,
 * and `ruleRows()` returns the SAME registry this instance judged through — one list,
 * one source, zero declaration re-copy. The registry is held on the instance, so an
 * injected rule set is what both the judgment and the `checked:` face report; the
 * argument-free production construction keeps `RULE_REGISTRY`.
 */
export class Contract {
  /** The per-doc-key policy sets — the declaration-derived doc-scope strategy family,
   *  each entry carrying BOTH the strategy and the declaration that tiered it. */
  readonly #strategies: Record<DocKey, readonly DocRuleBinding[]>;
  /** The rule registry this instance judged through — the injection seam's value, held
   *  so `ruleRows()` and the ledger judgment read the SAME list the doc policy did. */
  readonly #registry: readonly RuleDeclaration[];
  /** The projection carrier — the derived parse/skeleton faces the judgment reads. */
  readonly #projector: Projector;
  /** The row-source translator — the canonicalize seam carrier. One instance over
   *  the same locale word table the rest of the plane reads (the recognition face
   *  of the P7 translation layer); embedded like the projector, so the production
   *  construction points (`new Contract()`) stay argument-free. */
  readonly #translator: Translator;

  /** The row source — the ONE canonicalize seam (split + canonicalize once). */
  readonly #rowSource: RowSource;

  /** `registry` is the policy's injection seam (default `RULE_REGISTRY`): a round can
   *  drive the same coordinator over a small declared rule set without touching the
   *  shipped table — production construction stays argument-free. */
  constructor(registry: readonly RuleDeclaration[] = RULE_REGISTRY) {
    this.#registry = registry;
    this.#strategies = Contract.policy(registry);
    this.#projector = new Projector(declaredRegistries);
    this.#translator = new Translator(new Words());
    this.#rowSource = new RowSource(this.#translator);
  }

  /** The declared doc-scope composition — derived from the injected registry (default
   *  `RULE_REGISTRY`; only `scope: "doc"` rows — a doc judgment never runs a ledger
   *  rule). One strategy instance per row per construction, handed back PAIRED with its
   *  own declaration so the tier and the closed-document exemption travel with the
   *  strategy instead of being looked up a second time. */
  static policy(
    registry: readonly RuleDeclaration[] = RULE_REGISTRY,
  ): Record<DocKey, readonly DocRuleBinding[]> {
    const declarations = registry.filter(
      (declaration): declaration is DocRuleDeclaration => declaration.scope === "doc",
    );
    const policy = {} as Record<DocKey, readonly DocRuleBinding[]>;
    for (const key of DOC_KEYS) {
      policy[key] = declarations
        .filter((declaration) => declaration.docKeys === "all" || declaration.docKeys.includes(key))
        .map((declaration) => ({ declaration, strategy: declaration.create() }));
    }
    return policy;
  }

  /** The ONE tier-stamping point for a DECLARED rule: a strategy hands back drafts, the
   *  declaration says what a hit costs, and this joins them. Its exclusive claim runs
   *  over the declared rule set only — the parse face's own `doc-syntax` finding is not
   *  a rule and stamps its own tier (`#syntaxFinding`). */
  static stamped(
    drafts: readonly FindingDraft[],
    declaration: RuleDeclaration,
  ): readonly Finding[] {
    return drafts.map((draft) => ({ ...draft, severity: declaration.severity }));
  }

  /** The checked-list data face — every declaration row (both scopes) of THIS
   *  instance's registry, in registry order. The pre-flight renders these rows; it
   *  never writes a second list. */
  ruleRows(): readonly RuleDeclaration[] {
    return this.#registry;
  }

  /** validate(doc) — split, parse, compose, run, aggregate. The single doc judgment entry.
   *  The RAW content resolves its front-matter head first (the data plane — never
   *  canonicalized); the post-fence body lines canonicalize ONCE at the row source
   *  (the normalized view), and the SAME typed head rides into parse(lines, head)
   *  and JudgeContext.head (§2.2's delivery seam — the chain facts the head carries
   *  are the same record the invariants judge). The source stays intact.
   *  `closed` is the caller's proven-closure fact (design spec §1.4): a closed document
   *  exempts every declaration carrying `skipWhenClosed`, and only those. */
  validate(input: ContractInput, closed = false): Finding[] {
    return this.#docFindings(input, closed);
  }

  /** The doc-scope judgment body — the context construction (the ONLY caught step)
   *  plus every declared strategy of the input's doc key. */
  #docFindings(input: ContractInput, closed: boolean): Finding[] {
    let context: JudgeContext;
    try {
      context = this.#contextOf(input);
    } catch (error) {
      return [Contract.#syntaxFinding(input, error)];
    }
    const findings: Finding[] = [];
    for (const binding of this.#strategies[input.docKey]) {
      if (closed && binding.declaration.skipWhenClosed) continue;
      const drafts = binding.strategy.evaluate(context);
      findings.push(...Contract.stamped(drafts, binding.declaration));
    }
    return findings;
  }

  /** validateLedger(input, ledger) — the ledger-scope judgment entry (P21 §3.1): the
   *  plan document under judgment plus the ledger fact bundle, judged by every
   *  `scope: "ledger"` declaration applicable to the input's doc key. Two arguments,
   *  one judgment — the doc-scope rules never run here (and vice versa). */
  validateLedger(input: ContractInput, ledger: LedgerFacts): Finding[] {
    return this.#ledgerFindings(input, ledger);
  }

  /** The ledger-scope judgment body — the context construction (the ONLY caught
   *  step) plus every declared `scope: "ledger"` rule of the input's doc key. */
  #ledgerFindings(input: ContractInput, ledger: LedgerFacts): Finding[] {
    let context: JudgeContext;
    try {
      context = this.#contextOf(input);
    } catch (error) {
      return [Contract.#syntaxFinding(input, error)];
    }
    const findings: Finding[] = [];
    for (const declaration of this.#registry) {
      if (declaration.scope !== "ledger") continue;
      if (declaration.docKeys !== "all" && !declaration.docKeys.includes(input.docKey)) continue;
      const rule: LedgerRule = declaration.create();
      findings.push(...Contract.stamped(rule.evaluate(context, ledger), declaration));
    }
    return findings;
  }

  /** The document-syntax face of a judgment — the parse face throws a typed
   *  `DocSyntaxError`, the judgment materializes exactly ONE Finding bound to the
   *  contract path (never a registered rule, never a new gate). The catch wraps the
   *  `#contextOf` call ALONE (spec §2.2's seam): it never catches the strategy loop,
   *  so a `DocSyntaxError` from a strategy is a programming break that rethrows
   *  instead of discarding the findings this judgment already collected.
   *  This is the ONE finding outside the declared rule set, so it stamps its own tier:
   *  the parse face has always been a refusal, so it reads `block`. */
  static #syntaxFinding(input: ContractInput, error: unknown): Finding {
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

  /** The assembled judgment context — the shared split/parse/translate seam of both
   *  entries (one context construction, one canonicalize pass). */
  #contextOf(input: ContractInput): JudgeContext {
    // The row source resolves the raw front-matter head, then canonicalizes the
    // body ONCE (never a per-line translator API): the line face, the tree face and
    // the parse face all read the same normalized bytes.
    const { head, text, lines } = this.#rowSource.read(input.content);
    const tree = MarkdownTree.parse(text);
    const parsed = docTypeParsers[input.docKey].parse(lines, head, tree);
    return {
      docKey: input.docKey,
      parsed,
      head,
      tree,
      text,
      path: input.path,
      root: input.root,
      slices: this.#projector.slices()[input.docKey],
      shape: this.#projector.shape()[input.docKey],
      skeleton: this.#projector.skeleton()[input.docKey],
      registries: declaredRegistries,
      phaseId: input.phaseId,
      translator: this.#translator,
      slugIndex: input.slugIndex,
      fs: input.fs ?? new NodeFs(),
      taskLayers: input.taskLayers,
      graphIssues: input.graphIssues,
    };
  }
}
