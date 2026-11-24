// packages/cdd-engine/src-next/contract/__tests__/rules.test.ts
// The rule declaration surface's self-check (P21 §3.1): the registry IS the rule
// list — its row count, its id shape, the one-rule-one-strategy identity between a
// row's id and the created strategy's `name`, and the two scopes' distinct judgment
// entry shapes. A declaration drift must fail here, before any document judgment.
//
// P22 T8's plan-scope width rule is pinned here too (its host: the rule surface):
// a five-task DependsOn layer is red and names the layer's ids, chaining the extras
// green-lights it, and a call site with no injected layers yields zero findings. The
// final pin keeps the rule plane free of session imports — the width fact arrives
// through `JudgeContext.taskLayers`, never a second `batches()` derivation.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TaskGraph } from "../../session/graph.ts";
import { PlanDocType } from "../doc.ts";
import type { DocFs } from "../invariants.ts";
import { Contract } from "../judge.ts";
import { RULE_REGISTRY } from "../rules.ts";

/** The six public rule ids the phase spec declares (§3.1) — the consumer-facing
 *  face that must be in the registry by name. */
const PUBLIC_RULE_IDS = [
  "change-history-version-unique",
  "front-matter-version-in-lineage",
  "change-history-row-not-in-other-table",
  "list-marker-not-doubled",
  "closed-wave-fits-depends-on-layers",
  "planned-tasks-vs-recorded-tasks",
] as const;

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The registry's own source — the class comment above `RULE_REGISTRY` is prose with no
 *  path to red by construction, so its counts are pinned by a COMPUTED comparison
 *  against the table's own lengths rather than a literal grep (P42 §3.2). */
const RULES_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "rules.ts");

/** The P30/P31 change-history hardening ids — the row-shape, header-newest and
 *  header-column-set legs the lineage family gained (the ledger count above follows
 *  this list). */
const HARDENED_RULE_IDS = [
  "change-history-latest-matches-front-matter",
  "change-history-row-shape",
  "change-history-header-columns",
] as const;

describe("RULE_REGISTRY — the declaration surface", () => {
  it("keeps the class comment's counts equal to the table's own lengths — computed, never grepped", () => {
    // The comment's spelling (`doc scope … rows + ledger scope … rows = …`) differs
    // from this file's title spelling, so no literal grep holds either tree; the
    // comparison reads the three declared numbers and compares them cell by cell.
    const comment = readFileSync(RULES_SOURCE, "utf8").match(
      /doc scope (\d+) rows \+ ledger scope (\d+) rows = (\d+)/,
    );
    // the pair: a comment written without per-scope counts leaves this comparison no
    // subject — the null arm is the subject guard, not a courtesy
    expect(comment).not.toBeNull();
    const doc = RULE_REGISTRY.filter((row) => row.scope === "doc").length;
    const ledger = RULE_REGISTRY.filter((row) => row.scope === "ledger").length;
    // the pair: change any one of the three numbers in the comment and this goes red
    expect(Number(comment?.[1]), "doc rows").toBe(doc);
    expect(Number(comment?.[2]), "ledger rows").toBe(ledger);
    expect(Number(comment?.[3]), "total rows").toBe(doc + ledger);
  });

  it("keeps every id unique and kebab-cased", () => {
    const ids = RULE_REGISTRY.map((declaration) => declaration.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(KEBAB);
  });

  it("is one rule = one strategy: the created strategy's name IS the row id", () => {
    for (const declaration of RULE_REGISTRY) {
      const instance = declaration.create();
      expect(instance.name, declaration.id).toBe(declaration.id);
    }
  });

  it("keeps the two scopes' judgment entry shapes distinct (doc 1 arg, ledger 2 args)", () => {
    for (const declaration of RULE_REGISTRY) {
      const instance = declaration.create();
      expect(instance.evaluate.length, declaration.id).toBe(declaration.scope === "doc" ? 1 : 2);
    }
  });

  it("declares a non-empty doc-key set per row, and every ledger row names plan", () => {
    for (const declaration of RULE_REGISTRY) {
      if (declaration.docKeys === "all") continue;
      expect(declaration.docKeys.length, declaration.id).toBeGreaterThan(0);
      if (declaration.scope === "ledger") {
        expect(declaration.docKeys, declaration.id).toContain("plan");
      }
    }
  });

  it("carries the six public rule ids of the phase spec", () => {
    const ids = new Set(RULE_REGISTRY.map((declaration) => declaration.id));
    for (const id of PUBLIC_RULE_IDS) expect(ids.has(id), id).toBe(true);
  });

  it("carries the change-history hardening ids on the doc scope", () => {
    const docIds = new Set(
      RULE_REGISTRY.filter((declaration) => declaration.scope === "doc").map((row) => row.id),
    );
    for (const id of HARDENED_RULE_IDS) expect(docIds.has(id), id).toBe(true);
  });

  it("carries the P42 task-graph and order ids on the doc scope", () => {
    const docIds = new Set(
      RULE_REGISTRY.filter((declaration) => declaration.scope === "doc").map((row) => row.id),
    );
    for (const id of ["dangling-task-ref", "depends-on-cycle", "change-history-newest-last"]) {
      expect(docIds.has(id), id).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// `seat` — where each row's judgment runs (P42 §8)
// ---------------------------------------------------------------------------

/** The per-id seat table — the delivered registry read once, pinned as literals so a
 *  row's seat cannot move without a red here. */
const SEATS: Readonly<Record<string, readonly string[]>> = {
  presence: ["dispatch", "close"],
  "change-history-version-unique": ["dispatch", "close"],
  "change-history-row-shape": ["dispatch", "close"],
  "change-history-header-columns": ["dispatch", "close"],
  "change-history-latest-matches-front-matter": ["dispatch", "close"],
  "change-history-newest-last": ["dispatch", "close"],
  "task-id-unique": ["dispatch", "close"],
  "phase-id-unique": ["dispatch", "close"],
  domain: ["dispatch", "close"],
  crosslink: ["dispatch", "close"],
  "section-order": ["dispatch", "close"],
  "front-matter-version-in-lineage": ["dispatch", "close"],
  continuity: ["dispatch", "close"],
  residue: ["dispatch", "close"],
  hollow: ["dispatch", "close"],
  "link-shape": ["dispatch", "close"],
  "file-existence": ["dispatch", "close"],
  "sibling-scan": ["dispatch", "close"],
  "slug-ref": ["dispatch", "close"],
  "cross-doc-chain": ["dispatch", "close"],
  "section-scoped-domain": ["dispatch", "close"],
  "change-history-row-not-in-other-table": ["dispatch", "close"],
  "list-marker-not-doubled": ["dispatch", "close"],
  "wave-width-at-most-three": ["dispatch", "close"],
  "single-create": ["dispatch", "close"],
  "dangling-task-ref": ["dispatch", "close"],
  "depends-on-cycle": ["dispatch", "close"],
  "phase-design-spec-is-phase-spec": ["dispatch", "close"],
  "line-coordinate": ["dispatch", "close"],
  "live-arithmetic": ["dispatch", "close"],
  "single-home": ["dispatch", "close"],
  "change-history-date-shape": ["dispatch", "close"],
  "closed-wave-fits-depends-on-layers": ["ledger"],
  "planned-tasks-vs-recorded-tasks": ["ledger"],
};

describe("seat — the closed vocabulary of a row's judgment face (P42 §8)", () => {
  const SEAT_VOCABULARY = ["dispatch", "close", "ledger"] as const;

  it("declares one seat per row — the hand-written table against the registry's own length", () => {
    expect(Object.keys(SEATS)).toHaveLength(RULE_REGISTRY.length);
    expect(Object.keys(SEATS).sort()).toEqual(RULE_REGISTRY.map((row) => row.id).sort());
  });

  it("keeps every seat inside the closed set, and non-empty", () => {
    for (const row of RULE_REGISTRY) {
      expect(row.seat.length, row.id).toBeGreaterThan(0);
      for (const seat of row.seat) {
        expect(SEAT_VOCABULARY, `${row.id} · ${seat}`).toContain(seat);
      }
    }
    // the pair: an out-of-vocabulary value is red — the union admits no other word
    const outside = "gate";
    expect(SEAT_VOCABULARY).not.toContain(outside);
  });

  it("keeps the closed vocabulary equal to the faces the rows actually occupy", () => {
    // A word kept in the vocabulary after its last row dropped it would leave the union
    // declaring a face the tree no longer runs, so the two sides are compared — never
    // one side asserted alone.
    const occupied = [...new Set(RULE_REGISTRY.flatMap((row) => row.seat))].sort();
    expect([...SEAT_VOCABULARY].sort()).toEqual(occupied);
  });

  it("gives every doc row the two doc seats and every ledger row `ledger` alone", () => {
    for (const row of RULE_REGISTRY) {
      const expected = row.scope === "doc" ? ["dispatch", "close"] : ["ledger"];
      expect(row.seat, row.id).toEqual(expected);
    }
  });

  it("matches the per-id literal table cell by cell — a drift on either side is red", () => {
    for (const row of RULE_REGISTRY) {
      expect(row.seat, row.id).toEqual(SEATS[row.id]);
    }
  });
});

// ---------------------------------------------------------------------------
// wave-width-at-most-three — the plan-scope width rule (P22 §6)
// ---------------------------------------------------------------------------

/** The hermetic filesystem seam — the width rule reads no file, but the sibling
 *  strategies on the same policy do (they must not touch the real tree). */
const FS: DocFs = { exists: () => true, read: () => null, list: () => [] };

/** A plan document over `### Task N:` blocks + `- **DependsOn**:` values. */
const planDoc = (blocks: readonly (readonly string[])[]): string =>
  [
    "---",
    "title: Test Plan",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-10-09",
    "slug: x-p22",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    ...blocks.flat(),
  ].join("\n");

const task = (id: number, dependsOn: string): readonly string[] => [
  `### Task ${id}: task ${id}`,
  `- **DependsOn**: ${dependsOn}`,
];

/** The plan's layers — the SAME `TaskGraph#batches()` value the dispatch gates read. */
const layersOf = (blocks: readonly (readonly string[])[]): readonly (readonly number[])[] =>
  new TaskGraph(new PlanDocType("plan").parse(planDoc(blocks).split("\n"))).batches();

/** The width rule's findings over one plan, judged through the real contract. */
const widthFindings = (
  blocks: readonly (readonly string[])[],
  layers: readonly (readonly number[])[] | undefined,
): readonly { field: string; message: string }[] => {
  const input = {
    docKey: "plan" as const,
    path: "docs/kairos/plans/x-p22.md",
    content: planDoc(blocks),
    root: "/repo",
    fs: FS,
    ...(layers === undefined ? {} : { taskLayers: layers }),
  };
  return new Contract()
    .validate(input)
    .filter((finding) => finding.kind === "wave-width-at-most-three");
};

describe("wave-width-at-most-three — the plan-scope width rule (P22 §6)", () => {
  it("a five-task layer is red and names the layer's ids", () => {
    const blocks = [
      task(1, "none"),
      task(2, "none"),
      task(3, "none"),
      task(4, "none"),
      task(5, "none"),
    ];
    expect(layersOf(blocks)).toEqual([[1, 2, 3, 4, 5]]);
    const findings = widthFindings(blocks, layersOf(blocks));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.field).toBe("DependsOn");
    expect(findings[0]?.message).toContain("{1,2,3,4,5}");
    expect(findings[0]?.message).toContain("3-task limit");
  });

  it("chaining the extra tasks through DependsOn turns the same plan green", () => {
    // The author's repair: the last two tasks depend on the third, so the layer splits
    // into {1,2,3} + {4,5} and the plan-scope rule goes quiet.
    const blocks = [task(1, "none"), task(2, "none"), task(3, "none"), task(4, "3"), task(5, "3")];
    expect(layersOf(blocks)).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
    expect(widthFindings(blocks, layersOf(blocks))).toEqual([]);
  });

  it("a plan with no layer fact yields zero findings — never a refusal", () => {
    // TaskGraph#batches() is the sole width authority; a call site that injected no
    // layers has no plan graph to judge. The caller renders the degradation.
    const blocks = [task(1, "none"), task(2, "none"), task(3, "none"), task(4, "none")];
    expect(widthFindings(blocks, undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// the contract rule plane's structure pin — zero session imports
// ---------------------------------------------------------------------------

describe("the contract rule plane", () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  // The rule-judgment plane. `completion-criterion.ts` / `liveness-signal.ts` are the
  // dispatch-side contracts (they read the ledger's record types by design, spec §8
  // placement); the RULE plane must never derive from the session plane — its plan
  // layers arrive injected.
  const RULE_PLANE = ["invariants.ts", "rules.ts", "judge.ts", "declare.ts"] as const;

  it("carries zero `../session/` imports — the rule facts arrive injected", () => {
    for (const file of RULE_PLANE) {
      const source = readFileSync(path.resolve(HERE, "..", file), "utf8");
      expect(source, `${file} must not import the session plane`).not.toMatch(
        /from "\.\.\/session\//,
      );
    }
  });
});
