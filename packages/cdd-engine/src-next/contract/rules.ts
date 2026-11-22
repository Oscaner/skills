// packages/cdd-engine/src-next/contract/rules.ts
// The rule declaration surface — the ONE source of the structural rule list (P21
// §3.1/§3.4). A row is `id + applicable docKeys + scope`, and it is itself the
// factory: `create()` yields the strategy, whose `name` is verbatim the row id. The
// `Contract` policy composition walks these declarations (zero hard-coded `new`
// family), and the pre-flight `checked` list renders the SAME rows — "which rule
// ran" and "what it judged" cannot drift apart because neither has a second list.
//
// Two scopes, two entry shapes (one entry per judgment kind):
//   · `doc`    — an `Invariant`, judged over the document (`evaluate(ctx)`), by the
//                `doc-contract` gate;
//   · `ledger` — a `LedgerRule`, judged over the document AND the ledger fact bundle
//                (`evaluate(ctx, ledger)`), by the `plan-ledger` gate. The ledger facts
//                are deliberately NOT a `ContractInput` field: one entry, one judgment.
//
// The element registry (`ElementRegistry`) is the skeleton element table, not a rule
// list — these declarations are the rule surface. One rule = one strategy: the
// multi-surface strategies of the old family were split per leg (uniqueness → three,
// order → one section-order row, selfBounded → one lineage row), so a declaration row
// never hides a second rule. Version order is no longer presentation alone: the
// SEQUENCE leg is declared (`change-history-newest-last` — the row-ordered version
// sequence must be monotonic, and the DIRECTION never enters the judgment), beside the
// header-to-newest-row agreement, the header's own column set and the row's cell shape
// (`change-history-latest-matches-front-matter` · `change-history-header-columns` ·
// `change-history-row-shape`); the lineage identity read is membership-plus-anchor (the
// first cell must BE a version).
//
// Module-level exports are types / the declared data — zero behavior-carrying bare
// functions.

import type { FindingDraft, Invariant, JudgeContext } from "./invariants.ts";
import {
  ChangeHistoryDateShapeInvariant,
  ChangeHistoryHeaderColumnsInvariant,
  ChangeHistoryLatestMatchesFrontMatterInvariant,
  ChangeHistoryNewestLastInvariant,
  ChangeHistoryRowShapeInvariant,
  ChangeHistoryVersionUniqueInvariant,
  ContinuityInvariant,
  CrossDocChainInvariant,
  CrosslinkInvariant,
  DanglingTaskRefInvariant,
  DependsOnCycleInvariant,
  DomainInvariant,
  FileExistenceInvariant,
  FrontMatterVersionInLineageInvariant,
  HollowInvariant,
  LedgerLayeringRule,
  LedgerTaskSetRule,
  LineCoordinateInvariant,
  LinkShapeInvariant,
  ListMarkerInvariant,
  LiveArithmeticInvariant,
  MeasureLiteralInvariant,
  PhaseDesignSpecIsPhaseSpecInvariant,
  PhaseIdUniqueInvariant,
  PresenceInvariant,
  ResidueInvariant,
  RowHomeInvariant,
  SectionOrderInvariant,
  SectionScopedDomainInvariant,
  SiblingScanInvariant,
  SingleCreateInvariant,
  SingleHomeInvariant,
  SlugRefInvariant,
  TaskIdUniqueInvariant,
  WaveWidthInvariant,
} from "./invariants.ts";
import type { LedgerFacts } from "./judge.ts";
import type { DocKey } from "./project.ts";

/** The cells both scopes declare: identity, applicability, tier and the closed-document
 *  exemption. A rule's tier is DECLARED here, beside the rule, so "does a hit refuse
 *  the round or only warn" has exactly one home — the rule table (design spec §1.3). */
export interface RuleDeclarationBase {
  /** The rule id (kebab) — the strategy's `name` and the `checked` row's label. */
  readonly id: string;
  /** The applicable doc keys ("all" = the same judgment on all four doc types). */
  readonly docKeys: DocKey[] | "all";
  /** The tier a hit carries: `block` refuses the round, `warn` only annotates it. The
   *  value is stamped onto every finding this row produces (never filled by a strategy). */
  readonly severity: "block" | "warn";
  /** Whether a CLOSED document exempts this row (design spec §1.4): the five shape
   *  rules do, the long-standing structural rules do not. */
  readonly skipWhenClosed: boolean;
  /** WHERE this row's judgment runs (P42 §8) — a non-empty subset of the closed set
   *  below. A doc row carries the three doc-side seats; a ledger row carries `ledger`.
   *  The column is DECLARED here so a consumer can tell which gate faces a rule
   *  without reading its strategy. */
  readonly seat: readonly RuleSeat[];
}

/** The closed seat vocabulary (P42 §8) — where a rule's judgment is reached from. */
export type RuleSeat = "dispatch" | "close" | "corpus" | "ledger";

/** A doc-scope declaration: the factory yields an `Invariant` (`evaluate(ctx)`). */
export interface DocRuleDeclaration extends RuleDeclarationBase {
  readonly scope: "doc";
  /** Declaration-as-factory: the policy composition instantiates ONLY here. */
  readonly create: () => Invariant;
}

/** A ledger-scope declaration: the factory yields a `LedgerRule` (`evaluate(ctx, ledger)`). */
export interface LedgerRuleDeclaration extends RuleDeclarationBase {
  readonly scope: "ledger";
  /** Must include `"plan"` (a ledger rule has no target on a doc-less dispatch other
   *  than the plan it judges against). */
  readonly create: () => LedgerRule;
}

/** One rule declaration — the union of the two scopes. */
export type RuleDeclaration = DocRuleDeclaration | LedgerRuleDeclaration;

/** The ledger-scope judgment entry — two arguments, one per fact source. It hands
 *  back DRAFTS: the tier is stamped by the coordinator, never filled here. */
export interface LedgerRule {
  readonly name: string;
  evaluate(ctx: JudgeContext, ledger: LedgerFacts): FindingDraft[];
}

/** The rule registry — doc scope 33 rows + ledger scope 2 rows = 35. The five shape
 *  rows (the three variable classes · single-home · the record face's date shape) are
 *  P41's additions; they land at `block` beside the pre-existing block rows, the flip
 *  from their transitional `warn` being the phase's own last action. P42 adds four:
 *  `single-create` (the declaration set), the two task-graph judgments
 *  (`dangling-task-ref` · `depends-on-cycle`) and the Change-history order row
 *  (`change-history-newest-last`) — all four at `warn` until the phase's own flip.
 *
 *  `seat` declares WHERE each row's judgment runs (P42 §8): a doc row carries
 *  `dispatch` · `close` · `corpus`, a ledger row carries `ledger`. */
export const RULE_REGISTRY: readonly RuleDeclaration[] = [
  {
    scope: "doc",
    id: "presence",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new PresenceInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-version-unique",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new ChangeHistoryVersionUniqueInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-row-shape",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new ChangeHistoryRowShapeInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-header-columns",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new ChangeHistoryHeaderColumnsInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-latest-matches-front-matter",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new ChangeHistoryLatestMatchesFrontMatterInvariant(),
  },
  // P42 §6 — the ORDER leg of the same table. Its id is historical (it names the
  // retired "the newest row is last" assertion); the judgment is monotonicity, and the
  // direction never enters it. A closed document is exempt (`skipWhenClosed`): re-sorting
  // a closed history is pure churn, and the rule targets a row misplaced in flight.
  {
    scope: "doc",
    id: "change-history-newest-last",
    docKeys: "all",
    severity: "warn",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: true,
    create: () => new ChangeHistoryNewestLastInvariant(),
  },
  {
    scope: "doc",
    id: "task-id-unique",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new TaskIdUniqueInvariant(),
  },
  {
    scope: "doc",
    id: "phase-id-unique",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new PhaseIdUniqueInvariant(),
  },
  {
    scope: "doc",
    id: "domain",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new DomainInvariant(),
  },
  {
    scope: "doc",
    id: "crosslink",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new CrosslinkInvariant(),
  },
  {
    scope: "doc",
    id: "section-order",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new SectionOrderInvariant(),
  },
  {
    scope: "doc",
    id: "front-matter-version-in-lineage",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new FrontMatterVersionInLineageInvariant(),
  },
  {
    scope: "doc",
    id: "continuity",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new ContinuityInvariant(),
  },
  {
    scope: "doc",
    id: "residue",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new ResidueInvariant(),
  },
  {
    scope: "doc",
    id: "hollow",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new HollowInvariant(),
  },
  {
    scope: "doc",
    id: "link-shape",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new LinkShapeInvariant(),
  },
  {
    scope: "doc",
    id: "file-existence",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new FileExistenceInvariant(),
  },
  {
    scope: "doc",
    id: "sibling-scan",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new SiblingScanInvariant(),
  },
  {
    scope: "doc",
    id: "slug-ref",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new SlugRefInvariant(),
  },
  {
    scope: "doc",
    id: "cross-doc-chain",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new CrossDocChainInvariant(),
  },
  {
    scope: "doc",
    id: "section-scoped-domain",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new SectionScopedDomainInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-row-not-in-other-table",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new RowHomeInvariant(),
  },
  {
    scope: "doc",
    id: "list-marker-not-doubled",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new ListMarkerInvariant(),
  },
  {
    scope: "doc",
    id: "wave-width-at-most-three",
    docKeys: ["plan"],
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new WaveWidthInvariant(),
  },
  // P42's declaration-set row — lands at `warn` and is flipped by the phase's own last
  // action, so no half-flipped state is ever registered.
  {
    scope: "doc",
    id: "single-create",
    docKeys: ["plan"],
    severity: "warn",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new SingleCreateInvariant(),
  },
  // P42 §3.2's two task-graph judgments — graph PROPERTIES, not field shapes. Each owns
  // its own invariant class: `Invariant.name` is a literal and the tests assert
  // `name === id` per row, so one class can carry one name only.
  {
    scope: "doc",
    id: "dangling-task-ref",
    docKeys: ["plan"],
    severity: "warn",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new DanglingTaskRefInvariant(),
  },
  {
    scope: "doc",
    id: "depends-on-cycle",
    docKeys: ["plan"],
    severity: "warn",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new DependsOnCycleInvariant(),
  },
  {
    scope: "doc",
    id: "phase-design-spec-is-phase-spec",
    docKeys: ["overall"],
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: false,
    create: () => new PhaseDesignSpecIsPhaseSpecInvariant(),
  },
  // P41's shape gate — five rows, flipped to `block` by the phase's own last action (they
  // landed as `warn`, so no half-flipped state was ever registered). P42 §8 withdrew the
  // sixth: a present-tense description of the tree is prose, not a shape violation.
  {
    scope: "doc",
    id: "measure-literal",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: true,
    create: () => new MeasureLiteralInvariant(),
  },
  {
    scope: "doc",
    id: "line-coordinate",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: true,
    create: () => new LineCoordinateInvariant(),
  },
  {
    scope: "doc",
    id: "live-arithmetic",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: true,
    create: () => new LiveArithmeticInvariant(),
  },
  {
    scope: "doc",
    id: "single-home",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: true,
    create: () => new SingleHomeInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-date-shape",
    docKeys: "all",
    severity: "block",
    seat: ["dispatch", "close", "corpus"],
    skipWhenClosed: true,
    create: () => new ChangeHistoryDateShapeInvariant(),
  },
  {
    scope: "ledger",
    id: "closed-wave-fits-depends-on-layers",
    docKeys: ["plan"],
    severity: "block",
    seat: ["ledger"],
    skipWhenClosed: false,
    create: () => new LedgerLayeringRule(),
  },
  {
    scope: "ledger",
    id: "planned-tasks-vs-recorded-tasks",
    docKeys: ["plan"],
    severity: "block",
    seat: ["ledger"],
    skipWhenClosed: false,
    create: () => new LedgerTaskSetRule(),
  },
];
