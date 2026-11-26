// packages/cdd-engine/src/docs/judging/rules.ts
// The rule declaration surface — the ONE source of the structural rule list. A row is
// `id + applicable doc types + scope`, and it is itself the factory: `create()` yields the
// strategy, whose `name` is verbatim the row id. The coordinator walks these declarations
// (zero hard-coded `new` family), and the pre-flight `checked` list renders the SAME rows —
// "which rule ran" and "what it judged" cannot drift apart because neither has a second list.
//
// Two scopes, two entry shapes (one entry per judgment kind):
//   · `doc`    — an `Invariant`, judged over the document (`evaluate(ctx)`);
//   · `ledger` — a `LedgerRule`, judged over the document AND the ledger fact bundle
//                (`evaluate(ctx, ledger)`). The ledger facts are deliberately NOT a
//                `JudgeContext` field: one entry, one judgment.
//
// One rule = one strategy: every multi-surface strategy of the old family was split per leg
// (uniqueness → three rows, order → one section-order row, selfBounded → one lineage row), so
// a declaration row never hides a second rule.
//
// The registry and the strategy family it points at live TOGETHER (`invariants.ts`): a
// registry directory of its own would be a second box over one fact, and the phase removed
// that box on purpose. Deleting a row deletes one judgment; renaming a strategy breaks the
// row's `create()` and the family pin names the rule id.
//
// Module-level exports are types / the declared data — zero behaviour-carrying bare functions.

import type { DocType } from "../identity/types.ts";
import type { Invariant, LedgerRule } from "./invariants.ts";
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
  PhaseDesignSpecIsPhaseSpecInvariant,
  PhaseIdUniqueInvariant,
  PresenceInvariant,
  ResidueInvariant,
  RowHomeInvariant,
  SectionOrderInvariant,
  SectionScopedDomainInvariant,
  SiblingScanInvariant,
  SingleCreateInvariant,
  SlugRefInvariant,
  TaskIdUniqueInvariant,
  WaveWidthInvariant,
} from "./invariants.ts";

/** The cells both scopes declare: identity, applicability, tier and the closed-document
 *  exemption. A rule's tier is DECLARED here, beside the rule, so "does a hit refuse the
 *  round or only warn" has exactly one home. */
export interface RuleDeclarationBase {
  /** The rule id (kebab) — the strategy's `name` and the `checked` row's label. */
  readonly id: string;
  /** The applicable doc types ("all" = the same judgment on all four). */
  readonly docTypes: readonly DocType[] | "all";
  /** The tier a hit carries: `block` refuses the round, `warn` only annotates it. The value
   *  is stamped onto every finding this row produces (never filled by a strategy). */
  readonly severity: "block" | "warn";
  /** Whether a CLOSED document exempts this row: the shape rows do, the long-standing
   *  structural rules do not. */
  readonly skipWhenClosed: boolean;
  /** WHERE this row's judgment runs — a non-empty subset of the closed seat vocabulary. A doc
   *  row carries the two doc-side seats; a ledger row carries `ledger`. The column is
   *  DECLARED here so a consumer can tell which gate faces a rule without reading its
   *  strategy. */
  readonly seat: readonly RuleSeat[];
}

/** The closed seat vocabulary — where a rule's judgment is reached from. */
export type RuleSeat = "dispatch" | "close" | "ledger";

/** A doc-scope declaration: the factory yields an `Invariant` (`evaluate(ctx)`). */
export interface DocRuleDeclaration extends RuleDeclarationBase {
  readonly scope: "doc";
  /** Declaration-as-factory: the policy composition instantiates ONLY here. */
  readonly create: () => Invariant;
}

/** A ledger-scope declaration: the factory yields a `LedgerRule`
 *  (`evaluate(ctx, ledger)`). */
export interface LedgerRuleDeclaration extends RuleDeclarationBase {
  readonly scope: "ledger";
  /** Must include `plan` (a ledger rule has no target on a doc-less dispatch other than the
   *  plan it judges against). */
  readonly create: () => LedgerRule;
}

/** One rule declaration — the union of the two scopes. */
export type RuleDeclaration = DocRuleDeclaration | LedgerRuleDeclaration;

/** The rule registry — the doc-scope rows and the ledger-scope rows of one table. A row is
 *  the whole fact of one judgment: its id, the doc types it applies to, its tier, its
 *  closed-document exemption, its seat and the strategy class its `create()` builds. */
export const RULE_REGISTRY: readonly RuleDeclaration[] = [
  {
    scope: "doc",
    id: "presence",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new PresenceInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-version-unique",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new ChangeHistoryVersionUniqueInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-row-shape",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new ChangeHistoryRowShapeInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-header-columns",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new ChangeHistoryHeaderColumnsInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-latest-matches-front-matter",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new ChangeHistoryLatestMatchesFrontMatterInvariant(),
  },
  // The ORDER leg of the same table. Its id is historical (it names the retired "the newest
  // row is last" assertion); the judgment is monotonicity, and the direction never enters
  // it. A closed document is exempt: re-sorting a closed history is pure churn, and the rule
  // targets a row misplaced in flight.
  {
    scope: "doc",
    id: "change-history-newest-last",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: true,
    create: () => new ChangeHistoryNewestLastInvariant(),
  },
  {
    scope: "doc",
    id: "task-id-unique",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new TaskIdUniqueInvariant(),
  },
  {
    scope: "doc",
    id: "phase-id-unique",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new PhaseIdUniqueInvariant(),
  },
  {
    scope: "doc",
    id: "domain",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new DomainInvariant(),
  },
  {
    scope: "doc",
    id: "crosslink",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new CrosslinkInvariant(),
  },
  {
    scope: "doc",
    id: "section-order",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new SectionOrderInvariant(),
  },
  {
    scope: "doc",
    id: "front-matter-version-in-lineage",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new FrontMatterVersionInLineageInvariant(),
  },
  {
    scope: "doc",
    id: "continuity",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new ContinuityInvariant(),
  },
  {
    scope: "doc",
    id: "residue",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new ResidueInvariant(),
  },
  {
    scope: "doc",
    id: "hollow",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new HollowInvariant(),
  },
  {
    scope: "doc",
    id: "link-shape",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new LinkShapeInvariant(),
  },
  {
    scope: "doc",
    id: "file-existence",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new FileExistenceInvariant(),
  },
  {
    scope: "doc",
    id: "sibling-scan",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new SiblingScanInvariant(),
  },
  {
    scope: "doc",
    id: "slug-ref",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new SlugRefInvariant(),
  },
  {
    scope: "doc",
    id: "cross-doc-chain",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new CrossDocChainInvariant(),
  },
  {
    scope: "doc",
    id: "section-scoped-domain",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new SectionScopedDomainInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-row-not-in-other-table",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new RowHomeInvariant(),
  },
  {
    scope: "doc",
    id: "list-marker-not-doubled",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new ListMarkerInvariant(),
  },
  {
    scope: "doc",
    id: "wave-width-at-most-three",
    docTypes: ["plan"],
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new WaveWidthInvariant(),
  },
  {
    scope: "doc",
    id: "single-create",
    docTypes: ["plan"],
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new SingleCreateInvariant(),
  },
  // The two task-graph judgments — graph PROPERTIES, not field shapes. Each owns its own
  // invariant class: `Invariant.name` is a literal and the tests assert `name === id` per
  // row, so one class can carry one name only.
  {
    scope: "doc",
    id: "dangling-task-ref",
    docTypes: ["plan"],
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new DanglingTaskRefInvariant(),
  },
  {
    scope: "doc",
    id: "depends-on-cycle",
    docTypes: ["plan"],
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new DependsOnCycleInvariant(),
  },
  {
    scope: "doc",
    id: "phase-design-spec-is-phase-spec",
    docTypes: ["overall"],
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: false,
    create: () => new PhaseDesignSpecIsPhaseSpecInvariant(),
  },
  // The shape gate — the rows below. A description of the tree as it stands is prose, not a
  // shape violation; these three are the shapes.
  {
    scope: "doc",
    id: "line-coordinate",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: true,
    create: () => new LineCoordinateInvariant(),
  },
  {
    scope: "doc",
    id: "live-arithmetic",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: true,
    create: () => new LiveArithmeticInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-date-shape",
    docTypes: "all",
    severity: "block",
    seat: ["dispatch", "close"],
    skipWhenClosed: true,
    create: () => new ChangeHistoryDateShapeInvariant(),
  },
  {
    scope: "ledger",
    id: "closed-wave-fits-depends-on-layers",
    docTypes: ["plan"],
    severity: "block",
    seat: ["ledger"],
    skipWhenClosed: false,
    create: () => new LedgerLayeringRule(),
  },
  {
    scope: "ledger",
    id: "planned-tasks-vs-recorded-tasks",
    docTypes: ["plan"],
    severity: "block",
    seat: ["ledger"],
    skipWhenClosed: false,
    create: () => new LedgerTaskSetRule(),
  },
];
