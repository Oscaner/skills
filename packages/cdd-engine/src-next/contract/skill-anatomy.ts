// packages/cdd-engine/src-next/contract/skill-anatomy.ts
// T14 — the skill-anatomy contract typed export: skill-anatomy.json's content
// relocates into this typed constant module (the engine contract plane). The old
// JSON home is retired — the guard (scripts) consumes THIS export, never a JSON path.
//
// The contract: the node-anchored skill (SKILL.md) document structure — the
// section-heading registry (a STRICT allowlist), the `## Flow Digraph` mermaid
// section (mermaid-only), the `### `node`` node-definition grammar, the per-node
// four-element contract, the `## Invariants` / `## Failure Modes` tables, the
// BLOCKED terminal convention, the growth boundary (15 nodes / 17 edges — a
// crossing's rationale registers in this contract's registry), and the
// consumer-surface purity rule (SKILL.md carries zero growth/refactor narrative
// headings). Every fact the guard asserts is data here — the guard never restates
// a heading, pattern or limit.
//
// Module-level exports are type definitions + the declared contract constant —
// zero behavior-carrying bare functions (the plan's zero-bare-function discipline).

/** The section-registry keys — the strict `## ` allowlist (public + conditional). */
export interface AnatomySectionRegistry {
  public: readonly string[];
  conditional: readonly string[];
  sections: Readonly<Record<string, AnatomySectionRow>>;
  headingKinds: { nodeName: { pattern: string } };
}

/** One section registry row — the canonical heading (+ the conditional carriers). */
export interface AnatomySectionRow {
  heading: string;
  requiredCarriers?: readonly string[];
}

/** The `## Flow Digraph` content rule — mermaid-only, zero trailing prose. */
export interface AnatomyDigraph {
  sectionHeading: string;
  mermaidOnly: boolean;
  mermaidFence: string;
  nodeTypes: Readonly<Record<string, { pattern: string }>>;
  terminalStates: Readonly<Record<string, string>>;
  /** The unified-skeleton hub name — the shared NEXT-LOOP hub the loop-family
   *  shapes assert (every loop-family skill is a pipeline scope: the hub carries
   *  the two-edge shape and no handoff-* terminal — the closure routes through the
   *  engine's next face, the dissolved handoff, D33). */
  loopHubNode: {
    name: string;
  };
  /** The loop-condition phrases the loop-family NEXT-LOOP hub's out-edges may
   *  carry (the `until next is terminal` self-loop · the `no next` failure face).
   *  This slot IS the authoritative home for the family (P9 branch-review-1 F9):
   *  the phrases are the SKILL-digraph EDGE-LABEL vocabulary — a consumer-surface
   *  prose face the runtime `next:` never emits — so there is no engine runtime
   *  constant to derive them from (unlike the status family ← the word table and
   *  the route family ← `ROUTE_DECISION_WORDS`, both engine-grounded). The
   *  edge-conditions guard pins the two runtime-derived families against their
   *  engine sources and consumes THIS slot verbatim for the loop family. */
  nextLoopConditions: readonly string[];
}

/** The per-node four-element contract — the `### `node`` definitions' bullet fields. */
export interface AnatomyNodeElements {
  [field: string]: { pattern: string };
}

/** The node-definition grammar — the `### `node`` heading kind + the extension rule. */
export interface AnatomyNodeDefinitions {
  sectionHeading: string;
  headingKind: { pattern: string };
  extensionRule: string;
}

/** The growth boundary — limits + the registered-crossings rationale registry. */
export interface AnatomyGrowthBoundary {
  nodeLimit: number;
  edgeLimit: number;
  registry: { crossings: Record<string, unknown> };
}

/** The consumer-surface purity rule — the forbidden narrative-heading regression pins. */
export interface AnatomyConsumerPurity {
  forbiddenNarrativeHeads: readonly string[];
  zeroTraceRule: string;
}

/** The frontmatter-validity rule (spec §4 · D42) — every shipped SKILL.md's YAML
 *  frontmatter block must parse under a REAL YAML parser. A bare ASCII `: ` inside
 *  an unquoted scalar (e.g. `the engine's next: line`) makes the block unparseable,
 *  and the harness then silently drops the skill — an ungated declaration. */
export interface AnatomyFrontmatter {
  /** The frontmatter fence delimiter (the block between two `---` lines). */
  fence: string;
  /** The rule wording the check quotes when a frontmatter block fails to parse. */
  rule: string;
}

/** The author-entry bootstrap surface (§10 · the D29-regression pin) — the flow's
 *  content-authoring entry nodes and the skeleton bootstrap literal each one's Do
 *  must carry. D29's stripping rule keys on the ENTRY ROLE, not the surface shape:
 *  a node that authors a document (`author-spec` / `author-plan`) emits its target's
 *  `schema get … --output skeleton` bootstrap command (D29's own "entry-node bootstrap
 *  exception"), while the internal structure mirror (slot names / `:::fill`
 *  restatements) stays stripped. This fact pins the entry literals so a future
 *  shape-keyed strip cannot silently remove them again. */
export interface AnatomyAuthorBootstrap {
  /** The author-entry nodes — one (skill, node) pair per content-authoring entry. */
  entries: readonly { skill: string; node: string }[];
  /** The skeleton bootstrap command pattern each entry node's block must satisfy
   *  (the `schema get <type> --output skeleton <target>` render literal). */
  skeletonCommandPattern: string;
}

/** The six-skill roster row — one shipped kairos skill (the P4 closed set's data). */
export interface SkillRosterRow {
  /** The skill's role in the workflow normalization (§4.1). */
  role: "orchestrator" | "spec-writer" | "executor" | "utility";
  /** The flow family — the digraph-shape family the guard asserts:
   *  `loop` = the five-chain unified skeleton (NEXT-LOOP hub + self-loop + terminals);
   *  `close` = ends at the finish gate + terminal (no self-loop);
   *  `onepass` = one-pass · no self-loop (a one-shot toolchain or a forked-routing
   *  flow — covers both the linear cdd-report toolchain and the forked cdd-design
   *  routing; no self-loop either way). */
  family: "loop" | "close" | "onepass";
}

/** The full skill-anatomy contract — the typed structure facts the guard consumes. */
export interface SkillAnatomyContract {
  sectionRegistry: AnatomySectionRegistry;
  digraph: AnatomyDigraph;
  nodeDefinitions: AnatomyNodeDefinitions;
  nodeElements: AnatomyNodeElements;
  invariants: { table: { rowPattern: string } };
  failureModes: { table: { rowPattern: string } };
  blockedTerminal: { stateToken: string; requires: readonly string[] };
  growthBoundary: AnatomyGrowthBoundary;
  consumerPurity: AnatomyConsumerPurity;
  authorBootstrap: AnatomyAuthorBootstrap;
  /** The frontmatter-validity rule (spec §4 · D42) — the real-YAML-parse gate. */
  frontmatter: AnatomyFrontmatter;
  skills: { registry: Readonly<Record<string, SkillRosterRow>> };
  wording: Readonly<Record<string, string>>;
  /** The engine-lexicon pinned condition words (the v1.20 word-table pin) — the phrase set the
   *  digraph's loop/closure decision edges may carry (the NEXT-LOOP phrases + the
   *  decision status words + the Route-kind words). The static digraph truth and the
   *  runtime `next:` instance share this one list — the guard asserts every NEXT-LOOP
   *  out-edge label ∈ this set, and the wording test pins the set's derivation from
   *  the engine word table/Route lexicon (mechanical anti-drift, never a re-type). */
  edgeConditionWords: readonly string[];
}

/** The section-heading registry — the strict `## `/`### ` allowlist (public +
 *  conditional sections + the node-name heading grammar). */
const SECTION_REGISTRY = {
  public: ["flowDigraph", "nodeDefinitions", "invariants", "failureModes"],
  conditional: [],
  sections: {
    flowDigraph: { heading: "## Flow Digraph" },
    nodeDefinitions: { heading: "## Node Definitions" },
    invariants: { heading: "## Invariants" },
    failureModes: { heading: "## Failure Modes" },
  },
  headingKinds: { nodeName: { pattern: "^### `[^`]+`$" } },
} as const;

/** The six-skill roster — the P4 closed set: exactly these members ship, the 9th
 *  seat is vacant (a directory scan may carry zero more, zero missing); the family
 *  facts drive the digraph-shape assertions (consistency over the five chains). */
const SKILL_ROSTER: Readonly<Record<string, SkillRosterRow>> = {
  "cdd-design": { role: "orchestrator", family: "onepass" },
  "cdd-spec-writer": { role: "spec-writer", family: "loop" },
  "cdd-plan": { role: "orchestrator", family: "loop" },
  "cdd-dev": { role: "executor", family: "loop" },
  "cdd-close": { role: "orchestrator", family: "close" },
  "cdd-report": { role: "utility", family: "onepass" },
};

/** The skill-anatomy contract — one typed constant: the structure facts + the
 *  diagnostic wording the checks quote (single source, never a guard literal). */
export const SKILL_ANATOMY = {
  sectionRegistry: SECTION_REGISTRY,
  digraph: {
    sectionHeading: "## Flow Digraph",
    mermaidOnly: true,
    mermaidFence: "```mermaid",
    nodeTypes: {
      operator: { pattern: "^\\w+\\[.*\\]$" },
      decision: { pattern: "^\\w+\\{.*\\}$" },
      terminal: { pattern: "^\\w+\\(\\(.*\\)\\)$" },
    },
    terminalStates: { blocked: "BLOCKED", approved: "APPROVED" },
    // The five-chain unified skeleton — one shared hub across the loop family; the
    // hub carries the two-edge pipeline shape (the closure routes through the engine's
    // next face, D33 — no closure exit, no handoff-* terminal). The close/onepass
    // families are the explicit no-self-loop exceptions.
    loopHubNode: { name: "NEXT-LOOP" },
    // The v1.20 restored loop conditions — the pinned word face of the NEXT-LOOP hub's
    // two out-edges (the digraph's static branch truth, one table with the runtime
    // `next:` instance: `until next is terminal` self-loop · the `no next` failure
    // face. Each label must be one of these — the guard asserts it).
    nextLoopConditions: ["until next is terminal", "no next"],
  },
  nodeDefinitions: {
    sectionHeading: "## Node Definitions",
    headingKind: { pattern: "^### `[^`]+`$" },
    extensionRule: "prose sections map one-to-one to graph nodes",
  },
  nodeElements: {
    do: { pattern: "^- \\*\\*Do\\*\\*:" },
    read: { pattern: "^- \\*\\*Read\\*\\*:" },
    exit: { pattern: "^- \\*\\*Exit\\*\\*:" },
    fail: { pattern: "^- \\*\\*Fail\\*\\*:" },
  },
  invariants: { table: { rowPattern: "^\\|\\s*[A-Z]+\\d+\\s*\\|" } },
  failureModes: { table: { rowPattern: "^\\|[^\\n]+\\|$" } },
  blockedTerminal: {
    stateToken: "BLOCKED",
    requires: ["blocking reason", "recovery action", "no silent fallback"],
  },
  growthBoundary: {
    nodeLimit: 15,
    edgeLimit: 17,
    // The registered-growth rationale registry — a digraph crossing the boundary is
    // admitted here (never narrated inside the consumer SKILL.md). No crossing is
    // registered: every live digraph stays inside the node/edge limits.
    registry: {
      crossings: {} as Record<string, string>,
    },
  },
  consumerPurity: {
    forbiddenNarrativeHeads: ["## Flow size note", "## Full Flow Refactor Rationale"],
    zeroTraceRule: "zero trace in the consumer skill",
  },
  // The author-entry bootstrap surface (§10 · the D29-regression pin) — the
  // content-authoring entry nodes' skeleton bootstrap literals. D29 strips the
  // INTERNAL structure mirror (slot names / `:::fill` restatements), never the
  // entry node's bootstrap command (its own exception); this pins the literals so
  // a shape-keyed strip cannot silently remove them again.
  authorBootstrap: {
    entries: [
      { skill: "cdd-spec-writer", node: "author-spec" },
      { skill: "cdd-plan", node: "author-plan" },
    ],
    skeletonCommandPattern: "schema get \\S+ --output skeleton",
  },
  // The frontmatter-validity rule (spec §4 · D42) — every shipped SKILL.md's YAML
  // frontmatter block must parse under a REAL parser; a bare `: ` in an unquoted
  // scalar breaks the block and the harness silently drops the skill.
  frontmatter: {
    fence: "---",
    rule: "every SKILL.md frontmatter block must parse under a real YAML parser — an unquoted `: ` in a scalar makes the block unparseable and the harness silently drops the skill (D42)",
  },
  skills: { registry: SKILL_ROSTER },
  // The check-facing diagnostic wording — the prose the anatomy assertions quote
  // when a structure rule fires (the contract's self-describing face).
  wording: {
    registryRule:
      "the section-heading registry is a STRICT allowlist — a registry-external heading is a BLOCK because an undefined section is uncertainty on the consumer's real entry surface",
    headingKindRule:
      "every live `### ` heading is a backticked node-name heading (a node-definitions entry) — any other `### ` form is registry-external → BLOCK",
    digraphContentRule:
      "the Flow Digraph section carries EXACTLY ONE mermaid block and ZERO trailing prose — a flow intro line below the mermaid is redundant narration, forbidden on the consumer surface",
    nodeElementRule:
      "the per-node four-element contract — every node definition's prose carries Do / Read / Exit / Fail; a node missing any of the four elements is structurally incomplete",
    nodeDefinitionRule:
      "every digraph operator node has a definition heading and every definition heading names a digraph operator node (bidirectional completeness) — orphans and dangling nodes fail",
    growthRule:
      "crossing the growth boundary requires a rationale registered in this contract's growth registry — NEVER inside the consumer-shipped SKILL.md (consumer-surface purity)",
    purityRule:
      "SKILL.md is an instruction document — growth/refactor narrative headings are forbidden in ANY form; the rationale surface lives here, the consumer skill carries zero trace",
    closedSetRule:
      "the kairos skills are a CLOSED six-set registered in this contract's roster — the directory scan must carry exactly these members (9th seat vacant): an extra member is a new skill entering without registration, a missing member is a retired skill leaving without a plan entry",
    loopShapeRule:
      "the five-chain unified skeleton — every loop-family skill digraph carries the shared NEXT-LOOP hub; the hub carries TWO out-edges (the `until next is terminal` self-loop · the `no next` BLOCKED face) and NO handoff-* terminal — its closure routes through the engine's next face (the dissolved handoff, D33) (digraph↔Node Definitions↔text-reference consistency, shared node names must never drift)",
    enderShapeRule:
      "the explicit no-self-loop exceptions — cdd-close ends at the finish semantic gate + terminal, cdd-report is a one-shot toolchain, cdd-design is a forked-routing one-pass flow; a NEXT-LOOP self-loop in any of them is a shape violation",
    edgeConditionRule:
      "decision edges carry explicit condition labels — the NEXT-LOOP hub's out-edges ARE the pinned loop conditions (`until next is terminal` → self-loop · `no next` → BLOCKED) and every edge out of a decision node is condition-labeled; an unlabeled decision edge, a bare NEXT-LOOP self-loop, or a NEXT-LOOP out-edge count/condition that deviates from the pinned shape is a shape violation (the edge-zero-state-label rule retired v1.20)",
    routeFactRule:
      "the `next:` face renders through the word table's template rows — a pipeline `ref` renders the `route to {ref} skill` instruction phrase, a `literal` a cdd command string, a `done` the bare terminal word; a full cdd command string never follows the next: token on a line; BLOCKED/TIMEOUT carry no next line and are not consumed as next steps",
  },
  // The engine-lexicon pinned condition words (the v1.20 word-table pin) — the phrase
  // set the digraph's loop/closure decision edges may carry: the NEXT-LOOP phrases +
  // the decision status words (the word table's status vocabulary minus the failure
  // statuses) + the Route decision words (the `next:` lexical domain). This declared
  // value is PINNED by the engine-suite derivation gate
  // (contract/__tests__/edge-conditions.guard.test.ts) — it must equal the derivation
  // from the engine word table / Route lexicon (`CAPSULE_WORDS.status` minus
  // `FAILED_STATUS`, `ROUTE_DECISION_WORDS`, `nextLoopConditions`); a drifted engine
  // word fails that gate, never a silent second list. The kairos-suite edge assertion
  // consumes this set as its label allowlist.
  edgeConditionWords: [
    "until next is terminal",
    "no next",
    "APPROVED",
    "CHANGES_REQUESTED",
    "REVIEW_FIX",
    "done",
    "next-wave",
    "review",
    "fix",
    "soft-cap",
  ],
} as const satisfies SkillAnatomyContract;
