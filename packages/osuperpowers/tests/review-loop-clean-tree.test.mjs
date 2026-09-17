// packages/osuperpowers/tests/review-loop-clean-tree.test.mjs — P5 T10 assertion (one per skill):
// the six orchestrator SKILL.md review-fix loop wordings uniformly carry the clean-tree
// obligation — ensure the working tree is clean before entering review (spec §2.12 落点 4 + AC10).
// The mechanism is enforced by the engine's entry gate (dispatch/base.ts commitPreCheck — dirty →
// BLOCKED); the skills only state the obligation and must not re-implement it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.resolve(HERE, "..", "skills");

// The six skills running a review-fix loop whose entry dispatches `cdd review` (finishing has no
// review-fix loop and is intentionally not in the set).
const REVIEW_LOOP_SKILLS = [
  "writing-phase-spec",
  "writing-single-spec",
  "writing-overall-spec",
  "writing-plans",
  "brainstorming",
  "cli-driven-development",
];

const CLEAN_TREE_PHRASE = /ensure the working tree is clean before entering review/i;

for (const name of REVIEW_LOOP_SKILLS) {
  test(`${name}/SKILL.md review-fix loop wording: clean tree before entering review`, () => {
    const skill = readFileSync(path.join(SKILLS_ROOT, name, "SKILL.md"), "utf8");
    assert.match(
      skill,
      CLEAN_TREE_PHRASE,
      `${name}/SKILL.md review-fix loop is missing the clean-tree obligation sentence (ensure the working tree is clean before entering review)`,
    );
  });
}