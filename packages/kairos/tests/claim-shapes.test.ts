// packages/kairos/tests/claim-shapes.test.ts — the claim-shape vocabulary the two
// authoring nodes carry, read against ONE expected wording (P41 §4's resident list).
//
// Three homes state the same three shapes: the spec review rubric
// (`render/templates.ts#docNarrativeAxes`), `cdd-spec-writer`'s `author-spec` node and
// `cdd-plan`'s `author-plan` node. The gate judges a document by the rule rows those
// lines name, so a home that words the count form differently teaches the author a shape
// the gate then refuses — the rubric and the gate must not hold two answers.
//
// Two legs, both byte-level: each node carries the three listed lines VERBATIM (a
// reworded bullet goes red even when it keeps the duty's sense — the sense is the rule
// row, and a paraphrase is how the second answer is born), and the two nodes are
// byte-identical to each other (one vocabulary, not two). Line order is pinned by the
// same comparison: a reordered group is a different group.
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

/** The final wording (P41 §4) — one line per shape, each naming the rule row it mirrors.
 *  They are the expected bytes, never a re-derivation: the point of the pin is that a
 *  reworded home is caught, which a derived expectation could not do. */
const CLAIM_SHAPES = [
  "- **pin** — a behavior claim cites a colocated pin by module path + symbol name; a line coordinate is not a pin (`line-coordinate`)",
  "- **count** — a count is stated only as `census:<id> = <n>`, the id taken from the census registry; a bare integer plus a count unit in prose is refused (`measure-literal`), as is an arithmetic over live counts (`live-arithmetic`); naming the guard that maintains the value is the reason for the reference, not its form",
  "- **narrative** — a present-tense description of the tree as it stands is refused in a spec and in a plan alike: the `path:line` citation belongs to the plan, the condition that must hold to the spec; restate such a description as that condition (`temporal-indicator`)",
] as const;

/** The four rule rows the three lines point at — the count line names two of them
 *  (`measure-literal` · `live-arithmetic`), beside the legal `census:<id> = <n>` form
 *  whose id lives in the census registry rather than in a rule id. */
const NAMED_RULE_IDS = [
  "line-coordinate",
  "measure-literal",
  "live-arithmetic",
  "temporal-indicator",
] as const;

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

/** The same lines with the list indent trimmed — the wording face the expected strings
 *  are compared on (both nodes nest the group under their `Do` bullet). */
const claimShapeWording = (segment: string): readonly string[] =>
  claimShapeBullets(segment).map((line) => line.trim());

test("author-spec carries the three claim shapes, one line each, verbatim", () => {
  const node = nodeText(SPEC_WRITER_SKILL, "author-spec");
  expect(node, "the cdd-spec-writer `author-spec` node is missing").not.toBe("");
  expect(claimShapeWording(node)).toEqual([...CLAIM_SHAPES]);
});

test("author-plan carries the same three lines, byte-identical to author-spec", () => {
  const specWriter = claimShapeBullets(nodeText(SPEC_WRITER_SKILL, "author-spec"));
  const plan = claimShapeBullets(nodeText(PLAN_SKILL, "author-plan"));
  expect(plan.length, "the cdd-plan `author-plan` node carries no claim-shape group").toBe(
    CLAIM_SHAPES.length,
  );
  expect(plan, "the two nodes must state ONE vocabulary, down to the list indent").toEqual([
    ...specWriter,
  ]);
  expect(claimShapeWording(nodeText(PLAN_SKILL, "author-plan"))).toEqual([...CLAIM_SHAPES]);
});

test("every claim shape names the rule row it mirrors", () => {
  for (const [index, line] of CLAIM_SHAPES.entries()) {
    const named = NAMED_RULE_IDS.filter((id) => line.includes(`\`${id}\``));
    expect(named.length, `claim shape ${index} names no rule row`).toBeGreaterThan(0);
  }
  // The count line carries the legal form itself, not just the refusals around it: a
  // shape that names only what is refused leaves the author without a shape to write.
  expect(CLAIM_SHAPES[1]).toContain("`census:<id> = <n>`");
  expect(CLAIM_SHAPES[1]).toContain("census registry");
  expect(CLAIM_SHAPES[1]).not.toContain("pinned by the named guard");
});
