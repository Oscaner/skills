// packages/kairos/tests/status-routing-convergence.test.ts — C1 ①④ + C5 (T9) wording grep pin.
// The routing criterion's consumer-facing anchor: the convergence-carrier SKILL.md files must
// carry ZERO retired "blocker count" reading vocabulary and ZERO self-narrated S1/S2/S3 status→dispatch
// routing restatement (the retired "review closes in three segments … S1 → fix + re-review / S2 → fix
// closing round / S3 → done" prose and the retired "reads `status:` for routing" reading) — routing is
// delegated to the engine's `next:` face (its OUTPUT contract, never restated on the skill side: the
// node keeps one pointer line and the orchestrator's own obligations). The
// status vocabulary survives only as the closure anchors in the Review Convergence wording (the
// loop is the unified NEXT-LOOP hub — the retired `{status?}` decision node is gone, §4.2), never
// as narrated routing. The check reads the skill files directly (pure vitest, no shell grep
// chain) and asserts the required anchors so a future convergence rewrite that drops the `next:`
// pointer fails here.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.resolve(HERE, "..", "skills");

// The convergence carriers — the C1 ①④ status-routing re-anchor set (the loop-chain skills whose
// Review Convergence words the orchestrator surface). Scope is self-describing: this is the set
// that carries the convergence discipline, not an arbitrary file list. cdd-design is a one-pass
// forked-routing flow (no NEXT-LOOP hub) — its convergence wording rides the delegated writer flows,
// so it is not a carrier of the loop-chain convergence re-anchor.
const CARRIERS = ["cdd-dev", "cdd-spec-writer", "cdd-plan"];

// Retired wording — the "blocker count" read-interpretation vocabulary (M1/M3), the "three segments"
// S1/S2/S3 self-narrated status→dispatch routing restatement (C5/T9), and the retired `status:` reading
// idiom. Zero occurrences in the carrier SKILL.md files (unless the C1 blocker vocabulary was re-added).
const FORBIDDEN: Array<[string, RegExp]> = [
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

// Required anchors — the convergence vocabulary that must be present in every carrier: the unified
// loop hub (the NEXT-LOOP digraph node), the status closure vocabulary, the `next:`-face pointer (the
// engine's output contract is named, never restated), and the Mid-Flight Backfill compatibility
// sentence.
const REQUIRED: Array<[string, RegExp]> = [
  ["the unified NEXT-LOOP loop hub", /NEXT-LOOP/],
  ["S1 status anchor CHANGES_REQUESTED", /\bCHANGES_REQUESTED\b/],
  ["S2 status anchor REVIEW_FIX", /\bREVIEW_FIX\b/],
  ["S3 status anchor APPROVED", /\bAPPROVED\b/],
  ["the engine's `next:` face pointer", /the engine's `next:` face/],
  ["the Mid-Flight Backfill compatibility wording", /mid-backfill/],
];

for (const name of CARRIERS) {
  const skill = readFileSync(path.join(SKILLS_ROOT, name, "SKILL.md"), "utf8");

  // Test 1 asserts FORBIDDEN[0..6] — the C1 blocker-status reading block: the "blocker count"
  // reading tones, the `{blocker=0?}` decision node, the `blocker>0` / `blocker=0` edge conditions,
  // and the `status` / `blocker` output-contract columns.
  test(`status-routing wording: ${name} carries zero retired blocker-status reading vocabulary`, () => {
    for (const [label, re] of FORBIDDEN.slice(0, 7)) {
      expect(
        skill,
        `${name}/SKILL.md still carries the retired ${label} — the convergence criterion routes on ` +
          `status: / the next: line, never on a stdout blocker count`,
      ).not.toMatch(re);
    }
  });

  // Test 2 asserts FORBIDDEN[7..] — the C5 routing-restatement block: the S1/S2/S3 label ban, the
  // "three segments" retelling, the closing-round / re-review descriptors, and the retired
  // `status:`→dispatch reading idioms.
  test(`status-routing wording: ${name} carries zero retired S1/S2/S3 routing-restatement vocabulary`, () => {
    for (const [label, re] of FORBIDDEN.slice(7)) {
      expect(
        skill,
        `${name}/SKILL.md still carries the retired ${label} — the fix/review routing routes by the ` +
          `engine's \`next:\` face, never hand-narrated from a status mapping`,
      ).not.toMatch(re);
    }
  });

  test(`status-routing wording: ${name} anchors Review Convergence to the status criterion + the next: pointer`, () => {
    for (const [label, re] of REQUIRED) {
      expect(
        skill,
        `${name}/SKILL.md is missing the ${label} — Review Convergence must stay status-anchored in ` +
          `the digraph and route through the engine's \`next:\` face`,
      ).toMatch(re);
    }
  });
}

test("status-routing wording: cdd-dev Failure Modes ground a BLOCKED round on a carried reason", () => {
  const skill = readFileSync(path.join(SKILLS_ROOT, "cdd-dev", "SKILL.md"), "utf8");
  const failureModes = skill.slice(skill.indexOf("## Failure Modes"));
  // Isolate the BLOCKED row itself — the pin must tie the two together, not merely find each word
  // somewhere in the section (a sibling row's "reason" must not satisfy a BLOCKED row that lost its own).
  const blockedRow = failureModes.split("\n").find((line) => /^\|\s*BLOCKED\s*\|/.test(line));
  expect(blockedRow, "Failure Modes must carry a BLOCKED row").toBeDefined();
  expect(
    blockedRow,
    "a BLOCKED round must carry its reason for reporting (the behavior face, not an internal byte name)",
  ).toMatch(/reason/);
});

// The `next:` shape is the ENGINE's output contract — a skill that re-declares it (the literal-is-the-
// dispatch stance, the kind→command mapping note, the engine-default reference) is stating another
// face's fact. Zero occurrences across every shipped SKILL.md; the skills keep ONE pointer line plus
// their own orchestrator obligations.
const NEXT_SHAPE_RESTATEMENTS: Array<[string, RegExp]> = [
  ["the `next: is the dispatch` invariant heading", /next: is the dispatch/],
  ["the dispatch-as-written directive", /dispatch(?:ed)? it as written/],
  ["the read-the-`next:`-line instruction", /read the `next:` line/],
  ["the engine-default next-step reference", /default next step/],
  ["the kind→command mapping restatement", /kind→command mapping/],
  ["the dispatch-ready literal restatement", /dispatch-ready `next:`/],
];

test("status-routing wording: every shipped SKILL.md carries zero `next:` shape restatement", () => {
  for (const name of readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)) {
    const skill = readFileSync(path.join(SKILLS_ROOT, name, "SKILL.md"), "utf8");
    for (const [label, re] of NEXT_SHAPE_RESTATEMENTS) {
      expect(
        skill,
        `${name}/SKILL.md still carries ${label} — the \`next:\` shape is the engine's output ` +
          `contract: the skill keeps one pointer line and its own obligations`,
      ).not.toMatch(re);
    }
  }
});
