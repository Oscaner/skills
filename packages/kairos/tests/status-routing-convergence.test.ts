// packages/kairos/tests/status-routing-convergence.test.ts — C1 ①④ + C5 (T9) wording grep pin.
// The routing criterion's consumer-facing anchor: the five convergence-carrier SKILL.md files must
// carry ZERO retired "blocker count" reading vocabulary and ZERO self-narrated S1/S2/S3 status→dispatch
// routing restatement (the retired "review closes in three segments … S1 → fix + re-review / S2 → fix
// closing round / S3 → done" prose and the retired "reads `status:` for routing" reading) — routing is
// read off the output's `next:` suggestion line (the engine's default next-step, C5-0: dispatch per it
// when continuing directly; a mid-backfill or a user adjudication that lands governs over it). The
// status vocabulary survives only as the structural + closure anchors (the `{status?}` digraph decision
// node and the status edge labels, preserved verbatim), never as narrated routing. The check reads the
// skill files directly (pure node:test, no shell grep chain) and asserts the required anchors so a
// future convergence rewrite that drops the `next:` reading fails here.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.resolve(HERE, "..", "skills");

// The convergence carriers — the C1 ①④ status-routing re-anchor set (the five skills whose Review
// Convergence words the orchestrator surface). Scope is self-describing: this is the set that
// carries the convergence discipline, not an arbitrary file list.
const CARRIERS = ["cdd-dev", "cdd-spec", "cdd-charter", "cdd-phase", "cdd-plan"];

// Retired wording — the "blocker count" read-interpretation vocabulary (M1/M3), the "three segments"
// S1/S2/S3 self-narrated status→dispatch routing restatement (C5/T9), and the retired `status:` reading
// idiom. Zero occurrences in the carrier SKILL.md files (unless the C1 blocker vocabulary was re-added).
const FORBIDDEN = [
  ["`blocker` count", /`blocker` count/],
  ["blocker count (unbackticked)", /\bblocker count\b/],
  ["reads only the `status` reading instruction", /reads only the `status`/],
  ["`{blocker=0?}` digraph decision node", /\{blocker=0\?\}/],
  ["`blocker>0` edge condition", /\bblocker>0\b/],
  ["`blocker=0` edge condition", /\bblocker=0\b/],
  ["`status` / `blocker` output-contract columns", /`status` \/ `blocker`/],
  ["`S1`/`S2`/`S3` self-narrated routing labels", /\bS[123]\b/],
  ["the three-segment convergence restatement", /a review closes in three segments/],
  ["the S2 'closing round' closure descriptor", /closing round/],
  ["the S1 're-review is mandatory' re-review clause", /re-review is mandatory/],
  ["the retired `status:` reading wording", /reads? `status:` for routing/],
  ["the retired status→dispatch exit mapping", /routes CHANGES_REQUESTED \/ REVIEW_FIX/],
];

// Required anchors — the status criterion's structural anchors (the `{status?}` digraph decision node
// and the status vocabulary, surviving in the digraph edge labels) plus the `next:`-based routing
// vocabulary that must be present in every carrier: the unified reading wording, the engine's-default
// shared reference, the dispatch-per-it directive, and the I6 mid-backfill compatibility sentence.
const REQUIRED = [
  ["`{status?}` digraph decision node", /status\?/],
  ["S1 status anchor CHANGES_REQUESTED", /\bCHANGES_REQUESTED\b/],
  ["S2 status anchor REVIEW_FIX", /\bREVIEW_FIX\b/],
  ["S3 status anchor APPROVED", /\bAPPROVED\b/],
  ["the unified `next:` reading wording", /read the `next:` suggestion/],
  ["the shared next-step reference (engine's default)", /default next-step suggestion/],
  ["the dispatch-per-it directive", /dispatch per it/],
  ["the I6 mid-backfill compatibility wording", /mid-backfill/],
];

for (const name of CARRIERS) {
  const skill = readFileSync(path.join(SKILLS_ROOT, name, "SKILL.md"), "utf8");

  // Test 1 asserts FORBIDDEN[0..6] — the C1 blocker-status reading block: the "blocker count"
  // reading tones, the `{blocker=0?}` decision node, the `blocker>0` / `blocker=0` edge conditions,
  // and the `status` / `blocker` output-contract columns.
  test(`status-routing wording: ${name} carries zero retired blocker-status reading vocabulary`, () => {
    for (const [label, re] of FORBIDDEN.slice(0, 7)) {
      assert.doesNotMatch(
        skill,
        re,
        `${name}/SKILL.md still carries the retired ${label} — the convergence criterion routes on ` +
          `status: / the next: line, never on a stdout blocker count`,
      );
    }
  });

  // Test 2 asserts FORBIDDEN[7..] — the C5 routing-restatement block: the S1/S2/S3 label ban, the
  // "three segments" retelling, the closing-round / re-review descriptors, and the retired
  // `status:`→dispatch reading idioms.
  test(`status-routing wording: ${name} carries zero retired S1/S2/S3 routing-restatement vocabulary`, () => {
    for (const [label, re] of FORBIDDEN.slice(7)) {
      assert.doesNotMatch(
        skill,
        re,
        `${name}/SKILL.md still carries the retired ${label} — the fix/review routing is read off the ` +
          `engine's \`next:\` suggestion line, never hand-narrated from a status mapping`,
      );
    }
  });

  test(`status-routing wording: ${name} anchors Review Convergence to the status criterion + the next: reading`, () => {
    for (const [label, re] of REQUIRED) {
      assert.match(
        skill,
        re,
        `${name}/SKILL.md is missing the ${label} — Review Convergence must stay status-anchored in ` +
          `the digraph and route through the \`next:\` suggestion`,
      );
    }
  });
}

test("status-routing wording: cdd-dev Failure Modes ground BLOCKED via status + the stderr CDD_BLOCKED channel", () => {
  const skill = readFileSync(path.join(SKILLS_ROOT, "cdd-dev", "SKILL.md"), "utf8");
  const failureModes = skill.slice(skill.indexOf("## Failure Modes"));
  assert.match(
    failureModes,
    /status: BLOCKED/,
    "Failure Modes must route on `status: BLOCKED` (M4)",
  );
  assert.match(
    failureModes,
    /CDD_BLOCKED:/,
    "Failure Modes must name the stderr `CDD_BLOCKED:` reason channel",
  );
});
