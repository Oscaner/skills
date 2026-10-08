// packages/kairos/tests/review-loop-clean-tree.test.ts — P5 T10 assertion (one per loop chain):
// the four loop-chain SKILL.md review-fix loop wordings uniformly carry the clean-tree
// obligation — ensure the working tree is clean before entering review (spec §2.12 landing 4 + AC10).
// v1.26 (the semantic compression's single-source stance): the obligation rides the intro's
// Round-rhythm sentence exactly once per skill (the node-template duplication is retired), so the
// assertion counts the phrase across the whole skill file — present AND single-sourced. The
// mechanism is enforced by the engine's entry gate (dispatch/base.ts commitPreCheck — dirty →
// BLOCKED); the skills only state the obligation and must not re-implement it.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.resolve(HERE, "..", "skills");

// The loop-family carriers — the four skills whose review-fix rhythm carries the clean-tree
// obligation (cdd-close ends at the finish gate and cdd-report is a one-shot chain — neither has a
// review-fix loop and both are intentionally not in the set).
const CARRIERS = ["cdd-spec-writer", "cdd-plan", "cdd-dev", "cdd-design"];

const CLEAN_TREE_PHRASE = /ensure the working tree is clean before entering review/i;

for (const name of CARRIERS) {
  test(`${name}/SKILL.md review-fix loop wording: clean tree before entering review`, () => {
    const skill = readFileSync(path.join(SKILLS_ROOT, name, "SKILL.md"), "utf8");
    const occurrences = skill.split(CLEAN_TREE_PHRASE).length - 1;
    assert.equal(
      occurrences,
      1,
      `${name}/SKILL.md must carry the clean-tree obligation exactly once (the intro Round-rhythm single source — present AND single-sourced, node-template duplication retired)`,
    );
  });
}
