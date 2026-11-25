// packages/kairos/tests/claim-shapes.test.ts — the claim-shape vocabulary the two
// authoring nodes carry, read as STRUCTURE (P42 §6).
//
// Three homes state the same three shapes: the spec review rubric
// (`render/templates.ts#docNarrativeAxes`), `cdd-spec-writer`'s `author-spec` node and
// `cdd-plan`'s `author-plan` node. The gate judges a document by the rule rows those
// lines name, so a home that points at a different row teaches the author a shape the
// gate refuses — the rubric and the gate must not hold two answers.
//
// Wording is free; the mapping is fixed; the two nodes are byte-identical. Three arms
// read those three facts and nothing else:
//
//   · existence — each node carries exactly one bullet per shape prefix (`pin` ·
//     `count` · `narrative`), so a dropped shape is red;
//   · twin — the two nodes' bullets are byte-identical (list indent included), so a
//     reworded bullet in ONE node is red while rewording both is green;
//   · mapping — a shape prefix resolves to a fixed rule-id set (`pin` → one, `count` →
//     none, `narrative` → one), and that set is exactly what the line names.
//
// Zero module-level bare functions — the walkers are `const` arrows (the repository's
// zero-`function`-declaration discipline).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPEC_WRITER_SKILL = path.resolve(HERE, "../skills/cdd-spec-writer/SKILL.md");
const PLAN_SKILL = path.resolve(HERE, "../skills/cdd-plan/SKILL.md");

/** The two authoring nodes the vocabulary lives in — file and H3 node name. */
const NODES = [
  [SPEC_WRITER_SKILL, "author-spec"],
  [PLAN_SKILL, "author-plan"],
] as const;

/** The closed shape-prefix set, in declaration order. The prefix is the shape's
 *  identity; the sentence after it is the author's to word. */
const SHAPE_PREFIXES = ["pin", "count", "narrative"] as const;

type ShapePrefix = (typeof SHAPE_PREFIXES)[number];

/** shape → the rule ids its line MUST name, and the only ones it may name: `narrative`
 *  resolves to `line-coordinate` alone (the third shape row retired at P42 §8), and
 *  `count` resolves to none — the count row states a writing convention no gate judges,
 *  so a rule id there would name a criterion the tree no longer carries. */
const RULE_IDS_BY_SHAPE: Readonly<Record<ShapePrefix, readonly string[]>> = {
  pin: ["line-coordinate"],
  count: [],
  narrative: ["line-coordinate"],
};

/** The node's segment — from its own H3 heading to the next H3/H2 marker, so a sibling
 *  node's or a table's wording can never satisfy a pin this node must carry itself.
 *  `skill-anatomy.test.ts#nodeBlocks` walks the same heading grammar and is deliberately
 *  not shared: that walker hands back `name` + block for the anatomy registry, this one
 *  hands back one named segment, so a common helper would need a shape neither suite
 *  reads. */
const nodeText = (file: string, name: string): string => {
  const text = readFileSync(file, "utf8");
  const start = text.indexOf(`### \`${name}\``);
  if (start === -1) return "";
  const bounds = ["\n### ", "\n## "]
    .map((marker) => text.indexOf(marker, start + 1))
    .filter((index) => index !== -1);
  const end = bounds.length === 0 ? text.length : Math.min(...bounds);
  return text.slice(start, end);
};

/** The node's claim-shape bullets RAW (indent included) — the byte face the two nodes
 *  are compared on, so a node that indents its group differently is not "identical". */
const claimShapeBullets = (segment: string): readonly string[] =>
  segment
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => /^\s*- \*\*(?:pin|count|narrative)\*\* — /.test(line));

/** The shape prefix and trimmed wording of every claim-shape bullet, in document order. */
const shapesOf = (segment: string): readonly { shape: ShapePrefix; line: string }[] =>
  claimShapeBullets(segment).map((bullet) => {
    const shape = /^\s*- \*\*(pin|count|narrative)\*\* — /.exec(bullet)?.[1] as ShapePrefix;
    return { shape, line: bullet.trim() };
  });

/** The rule ids a line names — every backticked kebab-case token is a rule id (the
 *  vocabulary writes a row id that way), while a `path:line` / `- Modify: <path>` example
 *  is not. */
const ruleIdsOf = (line: string): readonly string[] => {
  const ids = [...line.matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)].map((match) => match[1] ?? "");
  return [...new Set(ids)];
};

test("each node carries one bullet per claim shape (the existence arm)", () => {
  for (const [file, node] of NODES) {
    const segment = nodeText(file, node);
    expect(segment, `${file} — the \`${node}\` node is missing`).not.toBe("");
    // Every prefix present, exactly once each, in declaration order: a dropped shape or
    // a second bullet for one prefix is red here.
    expect(
      shapesOf(segment).map((entry) => entry.shape),
      `${file} — the \`${node}\` node's claim shapes`,
    ).toEqual([...SHAPE_PREFIXES]);
  }
});

test("the two nodes state ONE vocabulary, down to the list indent (the twin arm)", () => {
  const specWriter = claimShapeBullets(nodeText(SPEC_WRITER_SKILL, "author-spec"));
  const plan = claimShapeBullets(nodeText(PLAN_SKILL, "author-plan"));
  expect(plan.length, "the cdd-plan `author-plan` node carries no claim-shape group").toBe(
    SHAPE_PREFIXES.length,
  );
  // Byte-identical, wording included: the two nodes must not fork a second vocabulary.
  expect(plan, "the two nodes must state ONE vocabulary, down to the list indent").toEqual([
    ...specWriter,
  ]);
});

test("each shape names exactly the rule ids its prefix maps to (the mapping arm)", () => {
  for (const [file, node] of NODES) {
    for (const { shape, line } of shapesOf(nodeText(file, node))) {
      expect(ruleIdsOf(line), `${file} — the \`${node}\` node's ${shape} line`).toEqual([
        ...RULE_IDS_BY_SHAPE[shape],
      ]);
    }
  }
});

test("the count shape states that no census registry exists", () => {
  const countLine = shapesOf(nodeText(SPEC_WRITER_SKILL, "author-spec")).find(
    (entry) => entry.shape === "count",
  )?.line;
  expect(countLine).toBeDefined();
  expect(countLine).toContain("no census registry exists");
});
