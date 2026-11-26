// packages/cdd-engine/src/docs/judging/__tests__/judging.test.ts
// The judging engine's pins: the rule table resolves one-to-one onto its strategy family, every
// rule answers a paired fixture (one violation reported, one compliant neighbour silent), the
// coordinator composes and stamps in order, the locator engine covers its walks, the reference
// lint never enters a verdict, the path grammar and the proven-closure reading answer their
// arms, and the downgrade note composes in exactly one place.
//
// Everything here is measured against the ENGINE and a fixture this file owns — never against
// this repository's own documents (they are the material the engine consumes in a real run).

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RepoPath } from "../../../env/paths/root.ts";
import { FrontMatterError } from "../../grammar/frontmatter.ts";
import { MarkdownTree } from "../../grammar/markdown-tree.ts";
import { TaskBlocks } from "../../grammar/task-blocks.ts";
import { declaredRegistries } from "../../identity/registry.ts";
import { Translator } from "../../identity/translate.ts";
import type { DocType } from "../../identity/types.ts";
import { Documents } from "../../index.ts";
import {
  ClosedDocument,
  DocumentIndex,
  type DocumentWorld,
  type IndexedDocument,
} from "../closure.ts";
import { displayReason, REGRADE_MARK, REGRADE_NOTE_SEPARATOR, regradeNote } from "../criteria.ts";
import type { FindingDraft, InjectedGraphIssue, Invariant, LedgerFacts } from "../invariants.ts";
import { LinkTargetShape } from "../invariants.ts";
import { Judge, type JudgeInput } from "../judge.ts";
import {
  type DocRuleDeclaration,
  RULE_REGISTRY,
  type RuleDeclaration,
  type RuleSeat,
} from "../rules.ts";
import { SelectorEngine } from "../selectors.ts";
import { PathShape } from "../shape-rules.ts";

// ---------------------------------------------------------------------------
// fixtures — the four clean documents and the world they live in
// ---------------------------------------------------------------------------

/** The repo-relative coordinate a fixture is judged under. */
const rel = (written: string): RepoPath => written as RepoPath;

const SPEC_PATH = rel("docs/kairos/specs/spec.md");
const PLAN_PATH = rel("docs/kairos/plans/plan.md");
const OVERALL_PATH = rel("docs/kairos/overalls/overall.md");
const SINGLE_PATH = rel("docs/kairos/specs/single.md");

/** The change-history table every clean fixture carries — one row, the declared column set. */
const HISTORY = [
  "## Change history",
  "",
  "| Version | date | summary | author |",
  "| --- | --- | --- | --- |",
  "| v0.1 | 2026-01-15 | first | author |",
];

/** A clean phase-spec: the design double layer, the acceptance surface, the constraint bullet. */
const SPEC = [
  "---",
  "title: Fixture spec",
  "doc-type: phase-spec",
  "version: v0.1",
  "date: 2026-01-15",
  "slug: 2026-01-15-fixture-design",
  "program: 2026-01-15-fixture-program",
  "author: author",
  "---",
  "",
  "## Design",
  "",
  "### 1. First layer",
  "",
  "#### 1.1 First item",
  "",
  "Prose body.",
  "",
  "### Acceptance criteria",
  "",
  "- `it passes`",
  "",
  "## Constraints",
  "",
  "- one rule",
  "",
  ...HISTORY,
].join("\n");

/** One task block with all seven reserved fields. */
const taskOf = (id: number, dependsOn: string, produces = "none", files = "- Create `a.ts`") => [
  `### Task ${id}: task ${id}`,
  "",
  "#### Objective",
  "",
  `the objective of task ${id}`,
  "",
  "#### Files",
  "",
  files,
  "",
  "#### Consumes",
  "",
  "none",
  "",
  "#### Produces",
  "",
  produces,
  "",
  "#### Steps",
  "",
  "- act — checkable: it passes",
  "",
  "#### Acceptance",
  "",
  "it passes",
  "",
  "#### DependsOn",
  "",
  dependsOn,
];

/** A clean plan: the constraint bullet, one task block and the change history. */
const PLAN = [
  "---",
  "title: Fixture plan",
  "doc-type: plan",
  "version: v0.1",
  "date: 2026-01-15",
  "slug: 2026-01-15-fixture-design",
  "---",
  "",
  "## Constraints",
  "",
  "- one rule",
  "",
  ...taskOf(1, "none"),
  "",
  ...HISTORY,
].join("\n");

/** A clean overall: every declared section, the three tables, the facets and one hard edge. */
const OVERALL = [
  "---",
  "title: Fixture program",
  "doc-type: overall",
  "version: v0.1",
  "date: 2026-01-15",
  "slug: 2026-01-15-fixture-program",
  "author: author",
  "---",
  "",
  "## Document scope",
  "",
  "Prose scope.",
  "",
  "## File paths",
  "",
  "| File | Purpose |",
  "| --- | --- |",
  "| `a.ts` | the file |",
  "",
  "## Program charter",
  "",
  "### Goal",
  "",
  "the goal",
  "",
  "### Non-goals",
  "",
  "none",
  "",
  "### Cross-cutting",
  "",
  "the axis",
  "",
  "## Issue inventory",
  "",
  "| Phase | Issue (ref) | Title summary |",
  "| --- | --- | --- |",
  "| P1 | none | first |",
  "",
  "## Phase inventory",
  "",
  "| Phase | Design spec | Implementation plan | Dependency |",
  "| --- | --- | --- | --- |",
  "| P1 | [spec](docs/kairos/specs/spec.md) | [plan](docs/kairos/plans/plan.md) | none |",
  "| P2 | [spec](docs/kairos/specs/spec.md) | [plan](docs/kairos/plans/plan.md) | P1 |",
  "",
  "## Dependency graph",
  "",
  "```",
  "P1 -> P2",
  "```",
  "",
  "-> = hard block",
  "",
  "## Boundary rules",
  "",
  "Prose boundary.",
  "",
  "## Constraints",
  "",
  "- one rule",
  "",
  "## Maintenance",
  "",
  "Prose maintenance.",
  "",
  ...HISTORY,
].join("\n");

/** A clean single-spec: the five declared sections. */
const SINGLE = [
  "---",
  "title: Fixture single",
  "doc-type: single-spec",
  "version: v0.1",
  "date: 2026-01-15",
  "slug: 2026-01-15-fixture-single",
  "author: author",
  "---",
  "",
  "## Background & root cause",
  "",
  "Prose.",
  "",
  "## Design decisions",
  "",
  "Prose.",
  "",
  "## Acceptance",
  "",
  "Prose.",
  "",
  "## Constraints",
  "",
  "- one rule",
  "",
  ...HISTORY,
].join("\n");

/** The four clean documents, by doc type. */
const CLEAN: Readonly<Record<DocType, string>> = {
  overall: OVERALL,
  plan: PLAN,
  "phase-spec": SPEC,
  "single-spec": SINGLE,
};

/** The four clean documents' coordinates, by doc type. */
const CLEAN_PATH: Readonly<Record<DocType, RepoPath>> = {
  overall: OVERALL_PATH,
  plan: PLAN_PATH,
  "phase-spec": SPEC_PATH,
  "single-spec": SINGLE_PATH,
};

/** The world the clean fixtures live in: the four documents, the two documents the program's
 *  Phase inventory links, and one bespoke single-spec the `phase-design-spec` arm reads. */
const CLEAN_FILES: ReadonlyMap<string, string> = new Map([
  [OVERALL_PATH, OVERALL],
  [PLAN_PATH, PLAN],
  [SPEC_PATH, SPEC],
  [SINGLE_PATH, SINGLE],
  ["docs/kairos/specs/spec2.md", SPEC],
  ["docs/kairos/plans/plan2.md", PLAN],
  ["docs/kairos/specs/bespoke.md", SINGLE],
]);

/** The three doc roots the fixtures live under. */
const ROOTS = {
  overalls: rel("docs/kairos/overalls"),
  specs: rel("docs/kairos/specs"),
  plans: rel("docs/kairos/plans"),
};

/** The clean identity index: the program overall and the design pair sharing one slug. */
const CLEAN_INDEX: readonly IndexedDocument[] = [
  { rel: OVERALL_PATH, slug: "2026-01-15-fixture-program", docType: "overall" },
  { rel: SPEC_PATH, slug: "2026-01-15-fixture-design", docType: "phase-spec" },
  { rel: PLAN_PATH, slug: "2026-01-15-fixture-design", docType: "plan" },
  { rel: SINGLE_PATH, slug: "2026-01-15-fixture-single", docType: "single-spec" },
];

/** One world over a file map — the read, existence, listing, index and scan-completeness faces
 *  a judgment asks. `complete` is the scan's own fact: false means the scan discarded a
 *  candidate, so its silence about an identity is not the disk's. */
const worldOf = (
  files: ReadonlyMap<string, string> = CLEAN_FILES,
  documents: readonly IndexedDocument[] = CLEAN_INDEX,
  complete = true,
): DocumentWorld => ({
  documents: () => documents,
  read: (target) => files.get(target) ?? null,
  exists: (target) => files.has(target),
  list: (directory) =>
    [...files.keys()]
      .filter((file) => file.startsWith(`${directory}/`))
      .map((file) => file.slice(directory.length + 1)),
  roots: () => ROOTS,
  complete: () => complete,
});

/** A judgment over a doctored world and an injected rule table — the coordinator's own seam. */
const judgeOver = (opts: {
  registry?: readonly RuleDeclaration[];
  files?: ReadonlyMap<string, string>;
  documents?: readonly IndexedDocument[];
  complete?: boolean;
}): Judge =>
  new Judge({
    ...(opts.registry === undefined ? {} : { registry: opts.registry }),
    translator: new Translator([]),
    world: worldOf(opts.files, opts.documents, opts.complete ?? true),
  });

/** The slice entry over a reader that reads nothing and the fixture world — the face pair
 *  (`judge` then `lintOf`) a dispatch-door gate calls on one document. */
const documentsOver = (): Documents =>
  new Documents({
    readText: (target) => ({ kind: "read-failure", target }),
    today: "2026-01-15",
    textWriter: (target) => ({ kind: "written", target }),
    world: worldOf(),
  });

/** The ONE row of a rule id — the single-rule registry a paired fixture judges through. */
const rowOf = (id: string): DocRuleDeclaration => {
  const row = RULE_REGISTRY.find((candidate) => candidate.id === id);
  if (row === undefined || row.scope !== "doc") {
    throw new Error(`the fixture names an unknown doc rule: ${id}`);
  }
  return row;
};

/** A judgment input over a clean or doctored document. */
const inputOf = (
  docKey: DocType,
  content: string,
  extra: {
    taskLayers?: readonly (readonly number[])[];
    graphIssues?: readonly InjectedGraphIssue[];
  } = {},
): JudgeInput => ({ docKey, path: CLEAN_PATH[docKey], content, ...extra });

/** The kinds an injected rule table reports over one input — the coordinator's plan face. */
const kindsOf = (judge: Judge, input: JudgeInput): readonly string[] =>
  judge.judge(input).map((finding) => finding.kind);

/** A clean document with a compliant construct swapped for a violating one — the paired fixture
 *  shape: the SAME position, one arm green and one arm red. */
const doctored = (base: string, swaps: readonly (readonly [string, string])[]): string =>
  swaps.reduce((text, [from, to]) => {
    if (!text.includes(from))
      throw new Error(`the fixture cannot swap a missing fragment: ${from}`);
    return text.replace(from, to);
  }, base);

// ---------------------------------------------------------------------------
// the rule table ↔ the strategy family
// ---------------------------------------------------------------------------

describe("the rule table and the strategy family it points at", () => {
  /** The ids whose factory does not yield a strategy of the same name — the ONE alignment
   *  test, so a renamed class fails here and NAMES the rule id it broke. */
  const misaligned = (registry: readonly RuleDeclaration[]): readonly string[] =>
    registry
      .filter((row) => row.create().name !== row.id)
      .map((row) => `${row.id} → ${row.create().name}`);

  it("resolves every row to a strategy whose name IS the row id", () => {
    expect(misaligned(RULE_REGISTRY)).toEqual([]);
  });

  it("is red when a row's class is renamed — the pin names the rule id", () => {
    const rows = RULE_REGISTRY.map((row) =>
      row.id === "presence" ? { ...row, id: "presence-renamed" } : row,
    );
    expect(misaligned(rows)).toEqual(["presence-renamed → presence"]);
  });

  it("keeps the family's size a function of the table, never a second roster", () => {
    const ids = new Set(RULE_REGISTRY.map((row) => row.id));
    const names = new Set(RULE_REGISTRY.map((row) => row.create().name));
    expect([...names].sort()).toEqual([...ids].sort());
  });

  it("declares a seat on every row, and only the closed seat vocabulary", () => {
    const seats: ReadonlySet<string> = new Set<RuleSeat>(["dispatch", "close", "ledger"]);
    for (const row of RULE_REGISTRY) {
      expect(row.seat.length).toBeGreaterThan(0);
      for (const seat of row.seat) expect(seats.has(seat)).toBe(true);
    }
  });

  it("fills every doc type's policy set from the table's own filter", () => {
    const policy = Judge.policy(RULE_REGISTRY);
    for (const docType of Object.keys(policy) as DocType[]) {
      expect(policy[docType].length).toBeGreaterThan(0);
      for (const binding of policy[docType]) {
        expect(binding.strategy.name).toBe(binding.declaration.id);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// the paired fixtures — one violation reported, one neighbour silent
// ---------------------------------------------------------------------------

/** One rule's paired fixture: a document that violates it, and the clean neighbour the same
 *  position carries when it conforms. */
interface RuleCase {
  /** The doc type the fixture is judged as. */
  readonly docKey: DocType;
  /** The violating document. */
  readonly violation: string;
  /** The compliant document (absent → the clean fixture for the doc type). */
  readonly silence?: string;
  /** The graph facts a rule needs injected. */
  readonly taskLayers?: readonly (readonly number[])[];
  /** The edge-validation issues a rule needs injected. */
  readonly graphIssues?: readonly InjectedGraphIssue[];
  /** The ledger facts a ledger-scope rule judges. */
  readonly ledger?: LedgerFacts;
  /** The world the fixture reads (absent → the clean world). */
  readonly files?: ReadonlyMap<string, string>;
}

/** The one injected cycle issue — the graph's rendered line travels WITH the fact. */
const CYCLE_ISSUE: InjectedGraphIssue = {
  kind: "cycle",
  task: 1,
  message: "a directed dependency cycle closes over task 1",
  fix: "break the cycle",
  detail: "cycle@T1: a directed dependency cycle closes over task 1",
};

/** The default ledger bundle — no open wave, no recorded task. */
const NO_LEDGER: LedgerFacts = {
  planTasks: [1],
  recordedTasks: [],
  closedWaves: [],
  openWaves: [],
  snapshots: [],
  layers: [[1]],
};

/** Four independent tasks — the wide-wave fixture (no task depends on another). */
const FOUR_TASKS = [
  "---",
  "title: Wide plan",
  "doc-type: plan",
  "version: v0.1",
  "date: 2026-01-15",
  "slug: 2026-01-15-fixture-design",
  "---",
  "",
  "## Constraints",
  "",
  "- one rule",
  "",
  ...[1, 2, 3, 4].flatMap((id) => [...taskOf(id, "none", "none", `- Create \`f${id}.ts\``), ""]),
  ...HISTORY,
].join("\n");

/** The world the `sibling-scan` violation reads: a document outside every scanned root. */
const OFF_TREE_FILE = "docs/notes/off-tree.md";

/** The cases — one per declared rule row, keyed by the row id. */
const RULE_CASES: Readonly<Record<string, RuleCase>> = {
  presence: {
    docKey: "plan",
    violation: doctored(PLAN, [
      ["#### Consumes\n\nnone\n\n", ""],
      ["#### Steps", "#### Steps"],
    ]),
  },
  "change-history-version-unique": {
    docKey: "single-spec",
    violation: doctored(SINGLE, [
      [
        "| v0.1 | 2026-01-15 | first | author |",
        "| v0.1 | 2026-01-15 | first | author |\n| v0.1 | 2026-01-16 | second | author |",
      ],
    ]),
  },
  "change-history-row-shape": {
    docKey: "single-spec",
    violation: doctored(SINGLE, [
      ["| v0.1 | 2026-01-15 | first | author |", "| v0.1 | 2026-01-15 | first |"],
    ]),
  },
  "change-history-header-columns": {
    docKey: "single-spec",
    violation: doctored(SINGLE, [
      ["| Version | date | summary | author |", "| Version | date | detail | author |"],
    ]),
  },
  "change-history-latest-matches-front-matter": {
    docKey: "single-spec",
    violation: doctored(SINGLE, [
      [
        "| v0.1 | 2026-01-15 | first | author |",
        "| v0.1 | 2026-01-15 | first | author |\n| v0.2 | 2026-01-16 | second | author |",
      ],
    ]),
  },
  "change-history-newest-last": {
    docKey: "single-spec",
    violation: doctored(SINGLE, [
      [
        "| v0.1 | 2026-01-15 | first | author |",
        "| v0.1 | 2026-01-15 | first | author |\n| v0.3 | 2026-01-16 | second | author |\n| v0.2 | 2026-01-17 | third | author |",
      ],
    ]),
  },
  "task-id-unique": {
    docKey: "plan",
    violation: doctored(PLAN, [
      ["### Task 1: task 1", "### Task 1: task 1\n\n### Task 1: duplicate task"],
    ]),
  },
  "phase-id-unique": {
    docKey: "overall",
    violation: doctored(OVERALL, [
      [
        "| P2 | [spec](docs/kairos/specs/spec.md) | [plan](docs/kairos/plans/plan.md) | P1 |",
        "| P2 | [spec](docs/kairos/specs/spec.md) | [plan](docs/kairos/plans/plan.md) | P1 |\n| P1 | [spec](docs/kairos/specs/spec.md) | [plan](docs/kairos/plans/plan.md) | P2 |",
      ],
    ]),
  },
  domain: {
    docKey: "plan",
    violation: doctored(PLAN, [["version: v0.1", "version: v1"]]),
  },
  crosslink: {
    docKey: "overall",
    violation: doctored(OVERALL, [
      [
        "| P2 | [spec](docs/kairos/specs/spec.md) | [plan](docs/kairos/plans/plan.md) | P1 |",
        "| P2 | [spec](docs/kairos/specs/spec.md) | [plan](docs/kairos/plans/plan.md) | P9 |",
      ],
    ]),
  },
  "section-order": {
    docKey: "single-spec",
    violation: doctored(SINGLE, [
      [
        "## Background & root cause\n\nProse.\n\n## Design decisions",
        "## Design decisions\n\nProse.\n\n## Background & root cause",
      ],
    ]),
  },
  "front-matter-version-in-lineage": {
    docKey: "single-spec",
    violation: doctored(SINGLE, [["version: v0.1", "version: v0.9"]]),
  },
  continuity: {
    docKey: "plan",
    violation: doctored(PLAN, [["### Task 1: task 1", "### Task 3: task 3"]]),
  },
  residue: {
    docKey: "phase-spec",
    violation: doctored(SPEC, [
      [
        "| v0.1 | 2026-01-15 | first | author |",
        "| v0.1 | 2026-01-15 | first | author |\n| a | b | Yes |",
      ],
    ]),
  },
  hollow: {
    docKey: "overall",
    violation: doctored(OVERALL, [["| P1 | none | first |\n", ""]]),
  },
  "link-shape": {
    docKey: "overall",
    violation: doctored(OVERALL, [
      ["[spec](docs/kairos/specs/spec.md)", "[spec](docs/kairos/specs/a b.md)"],
    ]),
  },
  "file-existence": {
    docKey: "overall",
    violation: doctored(OVERALL, [
      ["[spec](docs/kairos/specs/spec.md)", "[spec](docs/kairos/specs/missing.md)"],
    ]),
  },
  "sibling-scan": {
    docKey: "overall",
    violation: doctored(OVERALL, [
      ["[spec](docs/kairos/specs/spec.md)", `[spec](${OFF_TREE_FILE})`],
    ]),
  },
  "slug-ref": {
    docKey: "phase-spec",
    violation: doctored(SPEC, [
      ["program: 2026-01-15-fixture-program", "program: no-such-program"],
    ]),
  },
  "cross-doc-chain": {
    docKey: "plan",
    violation: doctored(PLAN, [
      ["slug: 2026-01-15-fixture-design", "slug: 2026-01-15-orphan-plan"],
    ]),
  },
  "section-scoped-domain": {
    docKey: "overall",
    violation: doctored(OVERALL, [["| P1 | none | first |", "| P1 | bogus | first |"]]),
  },
  "change-history-row-not-in-other-table": {
    docKey: "overall",
    violation: doctored(OVERALL, [["| `a.ts` | the file |", "| v0.2 | the file |"]]),
  },
  "list-marker-not-doubled": {
    docKey: "single-spec",
    violation: doctored(SINGLE, [["- one rule", "- - one rule"]]),
  },
  "wave-width-at-most-three": {
    docKey: "plan",
    violation: FOUR_TASKS,
    taskLayers: [[1, 2, 3, 4]],
  },
  "single-create": {
    docKey: "plan",
    violation: [
      "---",
      "title: Double create",
      "doc-type: plan",
      "version: v0.1",
      "date: 2026-01-15",
      "slug: 2026-01-15-fixture-design",
      "---",
      "",
      "## Constraints",
      "",
      "- one rule",
      "",
      ...taskOf(1, "none"),
      "",
      ...taskOf(2, "1"),
      "",
      ...HISTORY,
    ].join("\n"),
  },
  "dangling-task-ref": {
    docKey: "plan",
    violation: doctored(PLAN, [["#### Consumes\n\nnone", "#### Consumes\n\n- `b.ts`（Task 9）"]]),
  },
  "depends-on-cycle": {
    docKey: "plan",
    violation: PLAN,
    graphIssues: [CYCLE_ISSUE],
  },
  "phase-design-spec-is-phase-spec": {
    docKey: "overall",
    violation: doctored(OVERALL, [
      ["[spec](docs/kairos/specs/spec.md)", "[spec](docs/kairos/specs/bespoke.md)"],
    ]),
  },
  "line-coordinate": {
    docKey: "single-spec",
    violation: doctored(SINGLE, [
      [
        "## Background & root cause\n\nProse.",
        "## Background & root cause\n\nsee line 42 of the module.",
      ],
    ]),
  },
  "live-arithmetic": {
    docKey: "single-spec",
    violation: doctored(SINGLE, [
      ["## Background & root cause\n\nProse.", "## Background & root cause\n\n2 - 1 = 1 rules."],
    ]),
  },
  "change-history-date-shape": {
    docKey: "single-spec",
    violation: doctored(SINGLE, [
      ["| v0.1 | 2026-01-15 | first | author |", "| v0.1 | 15/01/2026 | first | author |"],
    ]),
  },
  "closed-wave-fits-depends-on-layers": {
    docKey: "plan",
    violation: PLAN,
    ledger: {
      ...NO_LEDGER,
      openWaves: [[1, 2]],
      layers: [[1], [2]],
      planTasks: [1, 2],
    },
  },
  "planned-tasks-vs-recorded-tasks": {
    docKey: "plan",
    violation: PLAN,
    ledger: { ...NO_LEDGER, planTasks: [1], recordedTasks: [9] },
  },
};

/** The world the `sibling-scan` arm reads — the clean world plus the off-tree document. */
const OFF_TREE_FILES: ReadonlyMap<string, string> = new Map<string, string>([
  ...CLEAN_FILES,
  [OFF_TREE_FILE, SINGLE],
]);

describe("every declared rule's paired fixture", () => {
  it("names a case for every declared row, and no case for an undeclared one", () => {
    expect(Object.keys(RULE_CASES).sort()).toEqual(RULE_REGISTRY.map((row) => row.id).sort());
  });

  for (const row of RULE_REGISTRY) {
    const id = row.id;
    const fixture = RULE_CASES[id] as RuleCase;

    const files = fixture.files ?? (id === "sibling-scan" ? OFF_TREE_FILES : undefined);

    it(`${id}: reports its violation`, () => {
      const judge = judgeOver({
        registry: [row],
        ...(files === undefined ? {} : { files }),
      });
      const input = inputOf(fixture.docKey, fixture.violation, {
        ...(fixture.taskLayers === undefined ? {} : { taskLayers: fixture.taskLayers }),
        ...(fixture.graphIssues === undefined ? {} : { graphIssues: fixture.graphIssues }),
      });
      const findings =
        row.scope === "ledger"
          ? judge.judgeLedger(input, fixture.ledger ?? NO_LEDGER)
          : judge.judge(input);
      expect(findings.length).toBeGreaterThan(0);
      for (const finding of findings) expect(finding.kind).toBe(id);
      expect(findings[0]?.severity).toBe(row.severity);
    });

    it(`${id}: is silent on the compliant neighbour`, () => {
      const judge = judgeOver({
        registry: [row],
        ...(files === undefined ? {} : { files }),
      });
      // The silence arm is the clean neighbour: the injected graph facts of the violation arm
      // do not travel with it (they are what made the violation over-wide).
      const input = inputOf(fixture.docKey, fixture.silence ?? CLEAN[fixture.docKey]);
      const findings =
        row.scope === "ledger" ? judge.judgeLedger(input, NO_LEDGER) : judge.judge(input);
      expect(findings).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// the coordinator
// ---------------------------------------------------------------------------

/** A strategy that reports one finding — the coordinator's order pin's first rule. */
class FirstRule {
  readonly name = "first-rule";

  evaluate(ctx: { readonly path: RepoPath }): readonly FindingDraft[] {
    return [
      { path: ctx.path, field: "first", message: "first rule", fix: "none", kind: this.name },
    ];
  }
}

/** A strategy that throws — the coordinator's containment pin. */
class ThrowingRule {
  readonly name = "throwing-rule";

  evaluate(): readonly FindingDraft[] {
    throw new Error("a strategy broke");
  }
}

/** A ledger row whose rule throws — the second entry's containment pin over the same seam. */
const throwingLedgerRow = (): RuleDeclaration => ({
  scope: "ledger",
  id: "throwing-ledger-rule",
  docTypes: ["plan"],
  severity: "block",
  seat: ["ledger"],
  skipWhenClosed: false,
  create: () => ({
    name: "throwing-ledger-rule",
    evaluate: () => {
      throw new Error("a ledger rule broke");
    },
  }),
});

/** One doctored declaration row over an arbitrary strategy. */
const rowFor = (id: string, create: () => Invariant): RuleDeclaration => ({
  scope: "doc",
  id,
  docTypes: "all",
  severity: "block",
  seat: ["dispatch", "close"],
  skipWhenClosed: false,
  create,
});

describe("the judgment coordinator", () => {
  it("composes every doc type's set from the table and never mixes the scopes", () => {
    const policy = Judge.policy(RULE_REGISTRY);
    // A doc-scope policy never carries a ledger row: `policy()` filters on the scope, so the
    // binding set and the table's doc rows are the same count per doc type.
    for (const docType of Object.keys(policy) as DocType[]) {
      const declared = RULE_REGISTRY.filter(
        (row) => row.scope === "doc" && (row.docTypes === "all" || row.docTypes.includes(docType)),
      );
      expect(policy[docType].length).toBe(declared.length);
    }
    const ledgerRows = RULE_REGISTRY.filter((row) => row.scope === "ledger");
    for (const row of ledgerRows) expect(row.docTypes).toContain("plan");
  });

  it("keeps the findings order the table's order, run after run", () => {
    const registry: readonly RuleDeclaration[] = [
      rowFor("first-rule", () => new FirstRule() as unknown as Invariant),
      // presence fires on a document missing its required surface
      rowOf("presence"),
    ];
    const judge = judgeOver({ registry });
    const input = inputOf("plan", doctored(PLAN, [["#### Consumes\n\nnone\n\n", ""]]));
    const first = kindsOf(judge, input);
    const second = kindsOf(judge, input);
    expect(first).toEqual(["first-rule", "presence"]);
    expect(second).toEqual(first);
  });

  it("stamps each draft with its own declaration's tier", () => {
    const registry: readonly RuleDeclaration[] = [{ ...rowOf("presence"), severity: "warn" }];
    const judge = judgeOver({ registry });
    const findings = judge.judge(
      inputOf("plan", doctored(PLAN, [["#### Consumes\n\nnone\n\n", ""]])),
    );
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) expect(finding.severity).toBe("warn");
  });

  it("keeps a throwing rule from swallowing the rules after it", () => {
    const registry: readonly RuleDeclaration[] = [
      rowFor("throwing-rule", () => new ThrowingRule() as unknown as Invariant),
      rowOf("presence"),
    ];
    const judge = judgeOver({ registry });
    const input = inputOf("plan", doctored(PLAN, [["#### Consumes\n\nnone\n\n", ""]]));
    const findings = judge.judge(input);
    // The broken rule refuses the verdict under its own name, and the next rule still answers.
    expect(findings.map((finding) => finding.kind)).toEqual(["rule-fault", "presence"]);
    expect(findings[0]?.field).toBe("throwing-rule");
    expect(findings[0]?.severity).toBe("block");
    expect(findings[0]?.message).toContain("throwing-rule");
  });

  it("contains a throwing ledger rule the same way", () => {
    const ledgerRow = throwingLedgerRow();
    const second = RULE_REGISTRY.find((row) => row.id === "planned-tasks-vs-recorded-tasks");
    expect(second).toBeDefined();
    const judge = judgeOver({ registry: [ledgerRow, ...(second === undefined ? [] : [second])] });
    const findings = judge.judgeLedger(inputOf("plan", PLAN), { ...NO_LEDGER, recordedTasks: [9] });
    expect(findings.map((finding) => finding.kind)).toEqual([
      "rule-fault",
      "planned-tasks-vs-recorded-tasks",
    ]);
    expect(findings[0]?.field).toBe("throwing-ledger-rule");
  });

  it("runs the ledger entry only over the ledger rows", () => {
    const judge = judgeOver({});
    const ledger = judge.judgeLedger(inputOf("plan", PLAN), {
      ...NO_LEDGER,
      recordedTasks: [9],
    });
    expect(ledger.map((finding) => finding.kind)).toEqual(["planned-tasks-vs-recorded-tasks"]);
    expect(judge.judge(inputOf("plan", PLAN)).map((finding) => finding.kind)).not.toContain(
      "planned-tasks-vs-recorded-tasks",
    );
  });

  it("answers the table it judged through, and nothing else", () => {
    const judge = judgeOver({});
    expect(judge.ruleRows()).toBe(RULE_REGISTRY);
  });
});

// ---------------------------------------------------------------------------
// the document-syntax refusal
// ---------------------------------------------------------------------------

describe("the document-syntax refusal", () => {
  /** One plan whose task block declares a reserved section twice — the parse face's own break. */
  const DOUBLED = doctored(PLAN, [
    ["#### Consumes", "#### Objective\n\na second objective\n\n#### Consumes"],
  ]);

  it("answers exactly one doc-syntax finding bound to the duplicated section", () => {
    const findings = judgeOver({}).judge(inputOf("plan", DOUBLED));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("doc-syntax");
    expect(findings[0]?.field).toBe("#### Objective");
    expect(findings[0]?.message).toBe(
      'task 1 carries the reserved section "#### Objective" more than once',
    );
    expect(findings[0]?.severity).toBe("block");
    expect(findings[0]?.fix.length).toBeGreaterThan(0);
  });

  it("materializes the same one finding on the ledger entry", () => {
    const findings = judgeOver({}).judgeLedger(inputOf("plan", DOUBLED), NO_LEDGER);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("doc-syntax");
    expect(findings[0]?.field).toBe("#### Objective");
  });

  it("rethrows a break that is not the parse face's own rejection", () => {
    const broken = doctored(PLAN, [["slug: 2026-01-15-fixture-design", "slug: [unclosed"]]);
    expect(() => judgeOver({}).judge(inputOf("plan", broken))).toThrow(FrontMatterError);
  });

  /** A charter carrying a task-shaped appendix — another document type's headings, one of
   *  them declared twice. The reserved set is the plan's grammar, so this document owes no
   *  refusal for it. */
  const APPENDIX = doctored(OVERALL, [
    [
      "## Change history",
      [
        "## Appendix — an example block",
        "",
        "### Task 1: an example",
        "",
        "#### Objective",
        "",
        "see line 42 of the module.",
        "",
        "#### Objective",
        "",
        "a second objective",
        "",
        "## Change history",
      ].join("\n"),
    ],
  ]);

  it("judges a non-plan document's task-shaped appendix by its own rows", () => {
    const kinds = judgeOver({})
      .judge(inputOf("overall", APPENDIX))
      .map((finding) => finding.kind);
    expect(kinds).not.toContain("doc-syntax");
    // The ordinary rows reached the appendix rather than a refusal replacing the verdict.
    const ordinary = judgeOver({ registry: [rowOf("line-coordinate")] }).judge(
      inputOf("overall", APPENDIX),
    );
    expect(ordinary.length).toBeGreaterThan(0);
    for (const finding of ordinary) expect(finding.kind).toBe("line-coordinate");
  });

  it("answers no observation where the judgment refuses the document", () => {
    // A dispatch-door gate runs the judgment and then the lint over one document: the refused
    // document answers one `doc-syntax` finding there and no observation here, never a throw
    // out of the command.
    const documents = documentsOver();
    expect(documents.judge(inputOf("plan", DOUBLED)).map((finding) => finding.kind)).toEqual([
      "doc-syntax",
    ]);
    expect(documents.lintOf(inputOf("plan", DOUBLED))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// the locator engine's coverage
// ---------------------------------------------------------------------------

/** The nine walks the engine must cover — the contract this pin holds it to. */
const WALKS = [
  "frontmatter",
  "heading",
  "table",
  "row",
  "cell",
  "list",
  "taskField",
  "taskStep",
  "graphEdge",
] as const;

describe("the locator engine", () => {
  it("is asked for every walk by a declared location", () => {
    // A walk is asked for either as an element's own surface or as the scope a composed
    // location starts from (a cell inside a row inside a table), so the chain is walked whole.
    const asked = new Set<string>();
    for (const docType of Object.keys(declaredRegistries) as DocType[]) {
      for (const element of declaredRegistries[docType].elements) {
        let location = element.selector;
        for (;;) {
          asked.add(location.walk);
          if (location.from === "root") break;
          location = location.from;
        }
      }
    }
    expect([...asked].sort()).toEqual([...WALKS].sort());
  });

  it("answers every walk on the clean fixtures", () => {
    // Each walked surface answers at least one node over the composite corpus: the fixture set
    // carries a document per doc type, so every surface (the plan's task fields and steps, the
    // charter's graph edges, the tables) has material to resolve against.
    const engines = (Object.keys(CLEAN) as DocType[]).map((docType) => {
      const tree = MarkdownTree.parse(CLEAN[docType]);
      return new SelectorEngine(tree, TaskBlocks.of(tree));
    });
    for (const walk of WALKS) {
      const total = engines.reduce(
        (sum, engine) => sum + engine.occurrences({ from: "root", walk }).length,
        0,
      );
      expect(`${walk}:${total > 0}`).toBe(`${walk}:true`);
    }
  });

  it("is red when a declared location stops matching", () => {
    // The counter-arm: the declared location resolves, and the SAME element with its match
    // removed resolves nothing — so an element cannot silently lose the selector it declares.
    const tree = MarkdownTree.parse(CLEAN.plan);
    const engine = new SelectorEngine(tree, TaskBlocks.of(tree));
    const declared = declaredRegistries.plan.elements.find(
      (element) => element.anchor === "## Constraints",
    );
    expect(declared).toBeDefined();
    expect(engine.occurrences(declared?.selector ?? { from: "root", walk: "heading" }).length).toBe(
      1,
    );
    expect(
      engine.occurrences({
        from: "root",
        walk: "heading",
        match: "## Nothing",
      }),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// the reference lint never enters the verdict
// ---------------------------------------------------------------------------

describe("the reference lint", () => {
  /** A plan whose second task's Objective cites the first task without declaring the edge. */
  const CITED = [
    "---",
    "title: Cited plan",
    "doc-type: plan",
    "version: v0.1",
    "date: 2026-01-15",
    "slug: 2026-01-15-fixture-design",
    "---",
    "",
    "## Constraints",
    "",
    "- one rule",
    "",
    ...taskOf(1, "none"),
    "",
    ...taskOf(2, "none", "none", "- Modify `a.ts`").map((line) =>
      line === "the objective of task 2" ? "see Task 1 for the shape" : line,
    ),
    "",
    ...HISTORY,
  ].join("\n");

  it("observes a suspected missing edge, and the judgment ignores it", () => {
    const documents = documentsOver();
    const warns = documents.lintOf(inputOf("plan", CITED));
    expect(warns.map((warn) => warn.kind)).toEqual(["reference-lint"]);
    expect(warns[0]?.message).toContain("Task 1");

    const before = documents.judge(inputOf("plan", PLAN));
    const after = documents.judge(inputOf("plan", CITED));
    expect(after.length).toBe(before.length);
  });

  it("answers no observation outside a plan", () => {
    expect(documentsOver().lintOf(inputOf("single-spec", SINGLE))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// the path grammar
// ---------------------------------------------------------------------------

describe("the path grammar", () => {
  it("reads a path-shaped token as a path, with its line span", () => {
    expect(PathShape.pathOf("packages/cdd-engine/src/bin.ts")).toEqual({
      path: "packages/cdd-engine/src/bin.ts",
    });
    expect(PathShape.pathOf("docs/kairos/specs/x.md:12-14")).toEqual({
      path: "docs/kairos/specs/x.md",
      firstLine: 12,
      lastLine: 14,
    });
  });

  it("reads a pattern-shaped token as no coordinate", () => {
    expect(PathShape.pathOf("<slug>-design.md")).toBeNull();
    expect(PathShape.pathOf("*-overall.md")).toBeNull();
    expect(PathShape.isPattern("<slug>-design.md")).toBe(true);
  });

  it("reads a separator-less dotted member as a symbol, not a file", () => {
    expect(PathShape.pathOf("process.env")).toBeNull();
    expect(PathShape.pathOf("docs/diagrams/src/architecture.png")).not.toBeNull();
    expect(PathShape.pathOf("session/ledger.ts#Round.findingsPath")).toBeNull();
  });

  it("normalizes two spellings of one location to one", () => {
    expect(PathShape.normalize("./a/b/")).toBe(PathShape.normalize("a/b"));
    expect(PathShape.normalize("./a/b/")).toBe("a/b");
  });
});

// ---------------------------------------------------------------------------
// the proven-closure reading
// ---------------------------------------------------------------------------

/** One charter declaring one phase Done on the named design/plan cells. */
const charterOf = (cells: { design: string; plan: string }): string =>
  [
    "---",
    "title: Fixture program",
    "doc-type: overall",
    "version: v0.1",
    "date: 2026-01-15",
    "slug: 2026-01-15-fixture-program",
    "author: author",
    "---",
    "",
    "## Phase inventory",
    "",
    "| Phase | Design spec | Implementation plan | Dependency |",
    "| --- | --- | --- | --- |",
    `| P1 | ✔ Done（\`${cells.design}\` · 2026-01-15） | ✔ Done（\`${cells.plan}\` · 2026-01-15） | none |`,
    "",
    ...HISTORY,
  ].join("\n");

/** A closure reading over one file map and one index. `complete` is the index's scan fact:
 *  false means the scan discarded a candidate, so a unique survivor is not a unique
 *  identification and nothing is proven closed. */
const closureOver = (
  files: ReadonlyMap<string, string>,
  documents: readonly IndexedDocument[],
  complete = true,
): ClosedDocument =>
  new ClosedDocument({
    index: new DocumentIndex(documents, complete),
    read: (target) => files.get(target) ?? null,
  });

describe("the identity chain over an incomplete scan", () => {
  /** A plan whose own identity pair is on disk but absent from the index — the scan discarded
   *  it, so the index's silence is not the disk's. */
  const orphan = doctored(PLAN, [
    ["slug: 2026-01-15-fixture-design", "slug: 2026-01-15-orphan-plan"],
  ]);
  const discarded = doctored(SPEC, [
    ["slug: 2026-01-15-fixture-design", "slug: 2026-01-15-orphan-plan"],
  ]);
  const files = new Map(CLEAN_FILES);
  files.set("docs/kairos/specs/discarded.md", discarded);

  it("stays silent when the scan discarded a candidate", () => {
    const judge = judgeOver({ registry: [rowOf("cross-doc-chain")], files, complete: false });
    expect(judge.judge(inputOf("plan", orphan))).toEqual([]);
  });

  it("answers the absence over a clean scan", () => {
    const judge = judgeOver({ registry: [rowOf("cross-doc-chain")], files, complete: true });
    expect(judge.judge(inputOf("plan", orphan)).map((finding) => finding.kind)).toEqual([
      "cross-doc-chain",
    ]);
  });
});

// ---------------------------------------------------------------------------
// the absolute link target's one owner
// ---------------------------------------------------------------------------

describe("the absolute link target", () => {
  const ABSOLUTE = "/Users/x/spec.md";
  /** A charter whose Design-spec cell names an existing absolute file — a spelling defect the
   *  shape face owns, never a missing file. */
  const absolute = doctored(OVERALL, [
    ["[spec](docs/kairos/specs/spec.md)", `[spec](${ABSOLUTE})`],
  ]);
  const files = new Map(CLEAN_FILES);
  files.set(ABSOLUTE, SPEC);

  it("is refused by the shape grammar, not probed as a location", () => {
    expect(LinkTargetShape.of(ABSOLUTE).target).toBeNull();
    expect(LinkTargetShape.of(ABSOLUTE).reason).toContain("bare relative path");
    expect(LinkTargetShape.of("../specs/x.md").target).toBe("../specs/x.md");
  });

  it("is one finding on the shape face and silence on the resolution faces", () => {
    const kinds = (id: string): readonly string[] =>
      judgeOver({ registry: [rowOf(id)], files })
        .judge(inputOf("overall", absolute))
        .map((finding) => finding.kind);
    expect(kinds("link-shape")).toEqual(["link-shape"]);
    expect(kinds("file-existence")).toEqual([]);
    expect(kinds("sibling-scan")).toEqual([]);
  });
});

describe("the proven-closure reading", () => {
  const indexOf = (extra: IndexedDocument): readonly IndexedDocument[] => [extra, ...CLEAN_INDEX];

  it("closes a document a phase registration names uniquely", () => {
    const files = new Map(CLEAN_FILES);
    files.set(OVERALL_PATH, charterOf({ design: "spec.md", plan: "plan.md" }));
    expect(
      closureOver(files, indexOf({ rel: OVERALL_PATH, slug: "p", docType: "overall" })).closed(
        SPEC_PATH,
      ),
    ).toBe(true);
  });

  it("proves nothing on zero hits", () => {
    const files = new Map(CLEAN_FILES);
    files.set(OVERALL_PATH, charterOf({ design: "no-such-doc.md", plan: "no-such-plan.md" }));
    expect(
      closureOver(files, indexOf({ rel: OVERALL_PATH, slug: "p", docType: "overall" })).closed(
        SPEC_PATH,
      ),
    ).toBe(false);
  });

  it("proves nothing on several hits", () => {
    const files = new Map(CLEAN_FILES);
    files.set(OVERALL_PATH, charterOf({ design: "spec.md", plan: "plan.md" }));
    const documents = [
      ...indexOf({ rel: OVERALL_PATH, slug: "p", docType: "overall" }),
      // a second document with the same base name makes the registration ambiguous
      { rel: rel("docs/kairos/plans/spec.md"), slug: "x", docType: "plan" },
    ];
    expect(closureOver(files, documents).closed(SPEC_PATH)).toBe(false);
  });

  it("proves nothing over a scan that discarded a candidate", () => {
    const files = new Map(CLEAN_FILES);
    files.set(OVERALL_PATH, charterOf({ design: "spec.md", plan: "plan.md" }));
    const documents = indexOf({ rel: OVERALL_PATH, slug: "p", docType: "overall" });
    // The registration's unique survivor is not a unique identification while the scan that
    // produced the index discarded a same-named candidate: a document sharing the judged
    // document's basename may be sitting outside the index, so nothing is closed and the
    // closure-gated rows keep running.
    expect(closureOver(files, documents, false).closed(SPEC_PATH)).toBe(false);
    // The neighbour: over a complete scan the same registration does prove closure.
    expect(closureOver(files, documents).closed(SPEC_PATH)).toBe(true);
  });

  it("exempts the rows that declare it, and only those", () => {
    const files = new Map(CLEAN_FILES);
    files.set(OVERALL_PATH, charterOf({ design: "spec.md", plan: "plan.md" }));
    const documents = indexOf({ rel: OVERALL_PATH, slug: "p", docType: "overall" });
    // A non-monotone lineage: the order row is exempt while closed, a neighbour is not.
    const drifting = doctored(SPEC, [
      [
        "| v0.1 | 2026-01-15 | first | author |",
        "| v0.1 | 2026-01-15 | first | author |\n| v0.3 | 2026-01-16 | second | author |\n| v0.2 | 2026-01-17 | third | author |",
      ],
    ]);
    const closedJudge = judgeOver({ registry: RULE_REGISTRY, files, documents });
    const openJudge = judgeOver({ registry: RULE_REGISTRY });
    const input = inputOf("phase-spec", drifting);
    const closedKinds = closedJudge.judge(input, true).map((finding) => finding.kind);
    const openKinds = openJudge.judge(input, false).map((finding) => finding.kind);
    expect(closedKinds).not.toContain("change-history-newest-last");
    expect(openKinds).toContain("change-history-newest-last");
    // The neighbour row (not `skipWhenClosed`) reports in both arms.
    expect(closedKinds.filter((kind) => kind === "change-history-version-unique")).toEqual(
      openKinds.filter((kind) => kind === "change-history-version-unique"),
    );
    expect(closureOver(files, documents).closed(SPEC_PATH)).toBe(true);
  });

  it("reads the registration form through one spelling", () => {
    expect(ClosedDocument.fileOf("✔ Done（`spec.md` · 2026-01-15）")).toBe("spec.md");
    expect(ClosedDocument.fileOf("[Pending]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// the four clean documents
// ---------------------------------------------------------------------------

describe("the four clean fixtures under the shipped table", () => {
  for (const docType of Object.keys(CLEAN) as DocType[]) {
    it(`${docType}: zero findings, zero warnings`, () => {
      const documents = new Documents({
        readText: (target) => ({ kind: "read-failure", target }),
        today: "2026-01-15",
        textWriter: (target) => ({ kind: "written", target }),
        world: worldOf(),
      });
      const input = inputOf(docType, CLEAN[docType]);
      expect(documents.judge(input)).toEqual([]);
      expect(documents.lintOf(input)).toEqual([]);
    });
  }

  it("reads the slice's closure and rule rows through one instance", () => {
    const documents = new Documents({
      readText: (target) => ({ kind: "read-failure", target }),
      today: "2026-01-15",
      textWriter: (target) => ({ kind: "written", target }),
      world: worldOf(),
    });
    expect(documents.ruleRows()).toBe(RULE_REGISTRY);
    expect(documents.closedAt(SPEC_PATH)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// the default document world
// ---------------------------------------------------------------------------

/** One `Documents` with no world injected — the construction the type still invites. */
const documentsWithoutWorld = (): Documents =>
  new Documents({
    readText: (target) => ({ kind: "read-failure", target }),
    today: "2026-01-15",
    textWriter: (target) => ({ kind: "written", target }),
  });

describe("the default document world", () => {
  it("refuses one no-world finding instead of reading an empty repository", () => {
    const findings = documentsWithoutWorld().judge(inputOf("plan", PLAN));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("no-world");
    expect(findings[0]?.field).toBe("world");
    expect(findings[0]?.severity).toBe("block");
    expect(findings[0]?.message).toContain("document world");
  });

  it("judges the same plan clean once the world is injected", () => {
    const documents = documentsWithoutWorld();
    expect(documents.judge(inputOf("plan", PLAN)).map((finding) => finding.kind)).toEqual([
      "no-world",
    ]);
    const withWorld = new Documents({
      readText: (target) => ({ kind: "read-failure", target }),
      today: "2026-01-15",
      textWriter: (target) => ({ kind: "written", target }),
      world: worldOf(),
    });
    expect(withWorld.judge(inputOf("plan", PLAN))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// the downgrade note's display face
// ---------------------------------------------------------------------------

describe("the downgrade note", () => {
  it("prints the mark alone when the reason is owed and none is stated", () => {
    expect(regradeNote(1, [])).toBe(REGRADE_MARK);
  });

  it("prints one stated reason alone, folded onto one line", () => {
    expect(regradeNote(0, ["a · b"])).toBe("a; b");
    expect(regradeNote(0, ["first\nsecond"])).toBe("first second");
    expect(displayReason("  padded reason  ")).toBe("padded reason");
  });

  it("prints nothing at all when the round owes no reason", () => {
    expect(regradeNote(0, [])).toBeUndefined();
    expect(regradeNote(0, ["   "])).toBeUndefined();
  });

  it("joins the mark and a stated reason with the declared separator", () => {
    expect(regradeNote(1, ["late edit"])).toBe(`${REGRADE_MARK}${REGRADE_NOTE_SEPARATOR}late edit`);
  });

  it("composes in exactly one place — no second copy under src/", () => {
    const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
    const sourceRoot = path.join(engineRoot, "src");
    const modules = productFiles(sourceRoot).map((file) => ({
      rel: path.relative(sourceRoot, file),
      text: readFileSync(file, "utf8"),
    }));
    expect(secondHomesOf(modules)).toEqual([]);
  });

  it("is red when a render site splices the mark instead of calling the one composition", () => {
    const spliced = {
      rel: "run/surface/board.ts",
      text: 'const note = [REGRADE_MARK, REGRADE_NOTE_SEPARATOR, reason].join("");',
    };
    const folded = {
      rel: "run/surface/capsule.ts",
      text: 'import { displayReason } from "../../docs/judging/criteria.ts";',
    };
    // The natural way to write one string: no export name is mentioned, the mark's sentence
    // and the separator are spelled into the template — a second home all the same.
    const inlined = {
      rel: "run/surface/board.ts",
      text: `const note = \`${REGRADE_MARK}${REGRADE_NOTE_SEPARATOR}the reason\`;`,
    };
    const throughTheOneHome = {
      rel: "run/surface/board.ts",
      text: 'import { regradeNote } from "../../docs/judging/criteria.ts";\nconst note = regradeNote(1, reasons);',
    };
    const home = { rel: "docs/judging/criteria.ts", text: "export const REGRADE_MARK = `x`;" };
    const barrel = {
      rel: "docs/index.ts",
      text: 'export { REGRADE_MARK, regradeNote } from "./judging/criteria.ts";',
    };
    expect(secondHomesOf([spliced, folded])).toEqual([
      "run/surface/board.ts",
      "run/surface/capsule.ts",
    ]);
    expect(secondHomesOf([inlined])).toEqual(["run/surface/board.ts"]);
    expect(secondHomesOf([throughTheOneHome, home, barrel])).toEqual([]);
  });
});

/** The note's export names — a product module that mentions one of them builds its own copy
 *  of the composition. `regradeNote` is deliberately absent: it is the ONE entry a render site
 *  calls, and its callers are not second homes. */
const NOTE_NAMES = /\b(REGRADE_MARK|REGRADE_NOTE_SEPARATOR|displayReason)\b/;

/** The note's declared VALUES carrying a letter — the mark's sentence names a copy the moment
 *  a module inlines it, which is exactly how a render site writes one string. The separator's
 *  `"; "` carries no letter and is punctuation the whole tree writes, so it names no copy on
 *  its own; both values are read off the one home rather than retyped here, so a change to
 *  the mark moves this scan with it. */
const NOTE_VALUES: readonly string[] = [REGRADE_MARK, REGRADE_NOTE_SEPARATOR].filter((value) =>
  /[A-Za-z]/.test(value),
);

/** One literal's regex source — the value is matched as the bytes it is, not as a pattern. */
const literalOf = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The needles: the export names, and every declared value that is a sentence. */
const NOTE_NEEDLES: readonly RegExp[] = [
  NOTE_NAMES,
  ...NOTE_VALUES.map((value) => new RegExp(literalOf(value))),
];

/** The two modules allowed to mention those needles: the ONE home, and the docs barrel that
 *  re-exports the public surface. Every other product module composes through `regradeNote`. */
const NOTE_HOMES: ReadonlySet<string> = new Set(["docs/judging/criteria.ts", "docs/index.ts"]);

/** The product modules carrying a second copy of the note's composition — the one-home scan. */
const secondHomesOf = (
  modules: readonly { readonly rel: string; readonly text: string }[],
): readonly string[] =>
  modules
    .filter((module) => !NOTE_HOMES.has(module.rel))
    .filter((module) => NOTE_NEEDLES.some((needle) => needle.test(module.text)))
    .map((module) => module.rel);

/** Every non-test TypeScript file under one root — the `src/**` scan basis. */
const productFiles = (root: string): readonly string[] => {
  const out: string[] = [];
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory)) {
      const full = path.join(directory, name);
      if (statSync(full).isDirectory()) {
        if (name === "__tests__" || name === "node_modules") continue;
        walk(full);
        continue;
      }
      if (name.endsWith(".ts")) out.push(full);
    }
  };
  walk(root);
  return out;
};
