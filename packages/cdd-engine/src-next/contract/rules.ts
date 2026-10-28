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
// order → two, selfBounded → two), so a declaration row never hides a second rule.
//
// Module-level exports are types / the declared data — zero behavior-carrying bare
// functions.

import type { Finding, Invariant, JudgeContext } from "./invariants.ts";
import {
  ChangeHistoryVersionAscendingInvariant,
  ChangeHistoryVersionUniqueInvariant,
  ContinuityInvariant,
  CrossDocChainInvariant,
  CrosslinkInvariant,
  DomainInvariant,
  FileExistenceInvariant,
  FrontMatterLastRowInvariant,
  HollowInvariant,
  LedgerLayeringRule,
  LedgerTaskSetRule,
  LinkShapeInvariant,
  ListMarkerInvariant,
  PhaseIdUniqueInvariant,
  PresenceInvariant,
  ResidueInvariant,
  RowHomeInvariant,
  SectionOrderInvariant,
  SectionScopedDomainInvariant,
  SelfBoundedIdNotInLineageInvariant,
  SiblingScanInvariant,
  SlugRefInvariant,
  TaskIdUniqueInvariant,
} from "./invariants.ts";
import type { LedgerFacts } from "./judge.ts";
import type { DocKey } from "./project.ts";

/** A doc-scope declaration: the factory yields an `Invariant` (`evaluate(ctx)`). */
export interface DocRuleDeclaration {
  readonly scope: "doc";
  /** The rule id (kebab) — the strategy's `name` and the `checked` row's label. */
  readonly id: string;
  /** The applicable doc keys ("all" = the same judgment on all four doc types). */
  readonly docKeys: DocKey[] | "all";
  /** Declaration-as-factory: the policy composition instantiates ONLY here. */
  readonly create: () => Invariant;
}

/** A ledger-scope declaration: the factory yields a `LedgerRule` (`evaluate(ctx, ledger)`). */
export interface LedgerRuleDeclaration {
  readonly scope: "ledger";
  readonly id: string;
  /** Must include `"plan"` (a ledger rule has no target on a doc-less dispatch other
   *  than the plan it judges against). */
  readonly docKeys: DocKey[] | "all";
  readonly create: () => LedgerRule;
}

/** One rule declaration — the union of the two scopes. */
export type RuleDeclaration = DocRuleDeclaration | LedgerRuleDeclaration;

/** The ledger-scope judgment entry — two arguments, one per fact source. */
export interface LedgerRule {
  readonly name: string;
  evaluate(ctx: JudgeContext, ledger: LedgerFacts): Finding[];
}

/** The rule registry — doc scope 21 rows + ledger scope 2 rows = 23. */
export const RULE_REGISTRY: readonly RuleDeclaration[] = [
  { scope: "doc", id: "presence", docKeys: "all", create: () => new PresenceInvariant() },
  {
    scope: "doc",
    id: "change-history-version-unique",
    docKeys: "all",
    create: () => new ChangeHistoryVersionUniqueInvariant(),
  },
  { scope: "doc", id: "task-id-unique", docKeys: "all", create: () => new TaskIdUniqueInvariant() },
  {
    scope: "doc",
    id: "phase-id-unique",
    docKeys: "all",
    create: () => new PhaseIdUniqueInvariant(),
  },
  { scope: "doc", id: "domain", docKeys: "all", create: () => new DomainInvariant() },
  { scope: "doc", id: "crosslink", docKeys: "all", create: () => new CrosslinkInvariant() },
  { scope: "doc", id: "section-order", docKeys: "all", create: () => new SectionOrderInvariant() },
  {
    scope: "doc",
    id: "change-history-version-ascending",
    docKeys: "all",
    create: () => new ChangeHistoryVersionAscendingInvariant(),
  },
  { scope: "doc", id: "continuity", docKeys: "all", create: () => new ContinuityInvariant() },
  { scope: "doc", id: "residue", docKeys: "all", create: () => new ResidueInvariant() },
  { scope: "doc", id: "hollow", docKeys: "all", create: () => new HollowInvariant() },
  {
    scope: "doc",
    id: "front-matter-version-matches-last-row",
    docKeys: "all",
    create: () => new FrontMatterLastRowInvariant(),
  },
  {
    scope: "doc",
    id: "self-bounded-id-not-in-lineage",
    docKeys: "all",
    create: () => new SelfBoundedIdNotInLineageInvariant(),
  },
  { scope: "doc", id: "link-shape", docKeys: "all", create: () => new LinkShapeInvariant() },
  {
    scope: "doc",
    id: "file-existence",
    docKeys: "all",
    create: () => new FileExistenceInvariant(),
  },
  { scope: "doc", id: "sibling-scan", docKeys: "all", create: () => new SiblingScanInvariant() },
  { scope: "doc", id: "slug-ref", docKeys: "all", create: () => new SlugRefInvariant() },
  {
    scope: "doc",
    id: "cross-doc-chain",
    docKeys: "all",
    create: () => new CrossDocChainInvariant(),
  },
  {
    scope: "doc",
    id: "section-scoped-domain",
    docKeys: "all",
    create: () => new SectionScopedDomainInvariant(),
  },
  {
    scope: "doc",
    id: "change-history-row-not-in-other-table",
    docKeys: "all",
    create: () => new RowHomeInvariant(),
  },
  {
    scope: "doc",
    id: "list-marker-not-doubled",
    docKeys: "all",
    create: () => new ListMarkerInvariant(),
  },
  {
    scope: "ledger",
    id: "closed-wave-fits-depends-on-layers",
    docKeys: ["plan"],
    create: () => new LedgerLayeringRule(),
  },
  {
    scope: "ledger",
    id: "planned-tasks-vs-recorded-tasks",
    docKeys: ["plan"],
    create: () => new LedgerTaskSetRule(),
  },
];
