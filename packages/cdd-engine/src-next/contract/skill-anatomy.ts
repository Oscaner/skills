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
  /** The unified-skeleton facts — the shared NEXT-LOOP hub + the terminal name
   *  prefixes the loop-family shapes assert (the multi-chain shared names). */
  loopHubNode: { name: string; rowPrefixes: readonly string[] };
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

/** The six-skill roster row — one shipped kairos skill (the P4 closed set's data). */
export interface SkillRosterRow {
  /** The skill's role in the workflow normalization (§4.1). */
  role: "orchestrator" | "spec-writer" | "executor" | "utility";
  /** The flow family — the digraph-shape family the guard asserts:
   *  `loop` = the five-chain unified skeleton (NEXT-LOOP hub + self-loop + terminals);
   *  `close` = ends at the finish gate + terminal (no self-loop);
   *  `onepass` = one-shot toolchain (no self-loop). */
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
  skills: { registry: Readonly<Record<string, SkillRosterRow>> };
  wording: Readonly<Record<string, string>>;
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
  "cdd-design": { role: "orchestrator", family: "loop" },
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
    terminalStates: { blocked: "BLOCKED", approved: "APPROVED", handoff: "HANDOFF" },
    // The five-chain unified skeleton — one shared hub + terminals across the loop
    // family; the close/onepass families are the explicit no-self-loop exceptions.
    loopHubNode: { name: "NEXT-LOOP", rowPrefixes: ["handoff-"] },
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
    registry: { crossings: {} },
  },
  consumerPurity: {
    forbiddenNarrativeHeads: ["## Flow size note", "## Full Flow Refactor Rationale"],
    zeroTraceRule: "zero trace in the consumer skill",
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
      "the five-chain unified skeleton — every loop-family skill digraph carries the shared NEXT-LOOP hub with its single self-loop + a commit-* terminal + a handoff-* terminal (digraph↔Node Definitions↔text-reference consistency, shared node names must never drift)",
    enderShapeRule:
      "the explicit no-self-loop exceptions — cdd-close ends at the finish semantic gate + terminal, cdd-report is a one-shot toolchain; a NEXT-LOOP self-loop in either is a shape violation",
    labelFreeRule:
      "the digraph edges carry ZERO state labels — the loop condition is the next: route fact, never an edge label (the retired review-fix loop node anchoring)",
    routeFactRule:
      "next: is consumed as a Route fact (kind + payload) mapped to the concrete command — a full cdd command string never follows the next: token on a line; BLOCKED/TIMEOUT carry no next line and are not consumed as next steps",
  },
} as const satisfies SkillAnatomyContract;
