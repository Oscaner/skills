// packages/osuperpowers/tests/writing-plans-spec.test.mjs — content contract for
// the F2 plan-header `**Spec:**` convention (P6 dogfood fix).
//
// The writing-plans `author-plan` node must mandate the plan-document header to
// carry a `**Spec:**` line as line 2 (after the `# Title`), linking the approved
// design doc. That link is real machinery, not prose:
//   - `plan-review` dispatches `cdd review --type plan --spec <spec-path>` from
//     the same approved spec (same-source pointer);
//   - report-issues resolves program attribution through `progress.json#plan` →
//     plan-header `**Spec:**` → overall → Related, with `progress.json#plan` as
//     the chain's first hop. The SKILL states the first hop as "the workspace
//     plan record" (guard-clean surface: orchestrating skills must not name
//     `progress.json` — AC5, residue.mjs INTERNAL_DEP_RE).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, "../skills/writing-plans/SKILL.md");

function authorPlanNode(text) {
  // The `author-plan` node block — from its H3 heading to the next H3 heading.
  const start = text.indexOf("### `author-plan`");
  const end = text.indexOf("\n### ", start === -1 ? 0 : start + 1);
  return { start, end, body: text.slice(start, end) };
}

test("author-plan node mandates the plan-header **Spec:** line-2 convention", () => {
  const { start, body } = authorPlanNode(readFileSync(SKILL, "utf8"));
  assert.ok(start !== -1, `author-plan node missing: ${SKILL}`);
  assert.match(body, /\*\*Spec:\*\*/, "author-plan Do must require the **Spec:** header line");
  assert.match(body, /line 2/, "convention must pin the header line to line 2");
  assert.match(body, /design\.md/, "convention must link <name>-design.md");
  assert.match(body, /plan record.*first hop/, "convention must record the report-issues first-hop dependency");
  assert.doesNotMatch(body, /resolve-destination/, "deleted resolve-destination node name must not survive in author-plan");
});
