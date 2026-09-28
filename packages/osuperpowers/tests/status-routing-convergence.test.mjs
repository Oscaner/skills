// packages/osuperpowers/tests/status-routing-convergence.test.mjs — C1 ①④ wording grep pin.
// The status-routing criterion's consumer-facing anchor: the five convergence-carrier SKILL.md
// files must carry ZERO retired "blocker count" reading wording and zero retired criterion terms
// (`{blocker=0?}` digraph decision, `blocker>0` / `blocker=0` edge conditions, the `status` /
// `blocker` count result-line phrasing) — the orchestrator routes on the review conclusion
// `status:` (CHANGES_REQUESTED ⟺ S1 fix+re-review / REVIEW_FIX ⟺ S2 closure / APPROVED ⟺ S3), and
// every convergence statement is status-anchored. The check reads the skill files directly (pure
// node:test, no shell grep chain), and asserts the required anchors so a future convergence
// rewrite that drops the status vocabulary fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.resolve(HERE, "..", "skills");

// The convergence carriers — the C1 ①④ status-routing re-anchor set (the five skills whose Review
// Convergence words the orchestrator surface). Scope is self-describing: this is the set that
// carries the convergence discipline, not an arbitrary file list.
const CARRIERS = [
  "cli-driven-development",
  "writing-single-spec",
  "writing-overall-spec",
  "writing-phase-spec",
  "writing-plans",
];

// Retired wording — the "blocker count" read-interpretation vocabulary and the old criterion terms.
// Zero occurrences in the carrier SKILL.md files (M1/M3: `blocker` anchors only the finding severity;
// the routing criterion is the review's conclusion status, never a stdout blocker count).
const FORBIDDEN = [
  ["`blocker` count", /`blocker` count/],
  ["blocker count (unbackticked)", /\bblocker count\b/],
  ["reads only the `status` reading instruction", /reads only the `status`/],
  ["`{blocker=0?}` digraph decision node", /\{blocker=0\?\}/],
  ["`blocker>0` edge condition", /\bblocker>0\b/],
  ["`blocker=0` edge condition", /\bblocker=0\b/],
  ["`status` / `blocker` output-contract columns", /`status` \/ `blocker`/],
];

// Required anchors — the status-routing vocabulary that must be present in every carrier.
// (The `{status?}` decision node, the three-value status anchors of Review Convergence, and the
// output-contract routing phrase.)
const REQUIRED = [
  ["`{status?}` digraph decision node", /status\?/],
  ["S1 status anchor CHANGES_REQUESTED", /\bCHANGES_REQUESTED\b/],
  ["S2 status anchor REVIEW_FIX", /\bREVIEW_FIX\b/],
  ["S3 status anchor APPROVED", /\bAPPROVED\b/],
  ["three-segment convergence statement", /a review closes in three segments/],
  ["read `status:` for routing", /reads `status:` for routing/],
];

for (const name of CARRIERS) {
  const skill = readFileSync(path.join(SKILLS_ROOT, name, "SKILL.md"), "utf8");

  test(`status-routing wording: ${name} carries zero retired "blocker count" reading wording`, () => {
    for (const [label, re] of FORBIDDEN) {
      assert.doesNotMatch(
        skill,
        re,
        `${name}/SKILL.md still carries the retired ${label} — the convergence criterion routes on ` +
          `status:, never on a stdout blocker count`,
      );
    }
  });

  test(`status-routing wording: ${name} anchors Review Convergence to the status criterion`, () => {
    for (const [label, re] of REQUIRED) {
      assert.match(
        skill,
        re,
        `${name}/SKILL.md is missing the ${label} — Review Convergence must be status-anchored`,
      );
    }
  });
}

test("status-routing wording: cli-driven-development Failure Modes ground BLOCKED via status + the stderr CDD_BLOCKED channel", () => {
  const skill = readFileSync(path.join(SKILLS_ROOT, "cli-driven-development", "SKILL.md"), "utf8");
  const failureModes = skill.slice(skill.indexOf("## Failure Modes"));
  assert.match(failureModes, /status: BLOCKED/, "Failure Modes must route on `status: BLOCKED` (M4)");
  assert.match(failureModes, /CDD_BLOCKED:/, "Failure Modes must name the stderr `CDD_BLOCKED:` reason channel");
});
