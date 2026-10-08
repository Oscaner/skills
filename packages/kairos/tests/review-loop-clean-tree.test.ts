// packages/kairos/tests/review-loop-clean-tree.test.ts — P5 T10 assertion (one per loop chain):
// the four loop-chain SKILL.md review-fix loop wordings uniformly carry the clean-tree
// obligation — ensure the working tree is clean before entering review (spec §2.12 落点 4 + AC10).
// Each assertion is scoped to the loop hub's own block (split on `### ` headings), not the
// whole file — a future edit that moves the obligation out of the loop node would fail here.
// The mechanism is enforced by the engine's entry gate (dispatch/base.ts commitPreCheck — dirty →
// BLOCKED); the skills only state the obligation and must not re-implement it.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.resolve(HERE, "..", "skills");

// Skill → the node(s) running its review-fix loop, where the clean-tree obligation sentence
// belongs (cdd-close ends at the finish gate and cdd-report is a one-shot chain — neither has a
// review-fix loop and both are intentionally not in the set). Under the unified skeleton the
// review-fix rhythm lives in each loop family's shared NEXT-LOOP hub.
const REVIEW_LOOP_NODES = {
  "cdd-spec-writer": ["NEXT-LOOP"],
  "cdd-plan": ["NEXT-LOOP"],
  "cdd-dev": ["NEXT-LOOP"],
  "cdd-design": ["NEXT-LOOP"],
};

const CLEAN_TREE_PHRASE = /ensure the working tree is clean before entering review/i;

// Split a SKILL.md into its `### `-headed node blocks: { title, block } (title without backticks).
function nodeBlocks(skillText: string) {
  return skillText
    .split(/^### /m)
    .slice(1)
    .map((section: string) => {
      const newline = section.indexOf("\n");
      const title = (newline === -1 ? section : section.slice(0, newline))
        .trim()
        .replace(/^`|`$/g, "");
      return { title, block: section };
    });
}

for (const [name, reviewNodes] of Object.entries(REVIEW_LOOP_NODES)) {
  test(`${name}/SKILL.md review-fix loop wording: clean tree before entering review`, () => {
    const skill = readFileSync(path.join(SKILLS_ROOT, name, "SKILL.md"), "utf8");
    const blocks = nodeBlocks(skill);
    for (const node of reviewNodes) {
      const block = blocks.find((b) => b.title === node);
      assert.ok(
        block,
        `${name}/SKILL.md has no \`${node}\` node (review-fix loop surface is missing)`,
      );
      assert.match(
        block.block,
        CLEAN_TREE_PHRASE,
        `${name}/SKILL.md \`${node}\` (review-fix loop node) is missing the clean-tree obligation sentence (ensure the working tree is clean before entering review)`,
      );
    }
  });
}
