// packages/kairos/tests/cdd-plan-spec.test.ts — content contract for
// the F2 plan-header `**Spec:**` convention (P6 dogfood fix).
//
// The cdd-plan `author-plan` node must mandate the plan-document header to
// carry a `**Spec:**` line as line 2 (after the `# Title`), linking the approved
// design doc. That link is real machinery, not prose:
//   - `plan-review` dispatches `cdd review --type plan --spec <spec-path>` from
//     the same approved spec (same-source pointer);
//   - cdd-report resolves program attribution through `progress.json#plan` →
//     plan-header `**Spec:**` → overall → Related, with `progress.json#plan` as
//     the chain's first hop. The SKILL states the first hop as "the workspace
//     plan record" (guard-clean surface: orchestrating skills must not name
//     `progress.json` — AC5, residue.ts INTERNAL_DEP_RE).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, "../skills/cdd-plan/SKILL.md");

function authorPlanNode(text: string) {
  // The `author-plan` node block — from its H3 heading to the next H3 heading.
  const start = text.indexOf("### `author-plan`");
  const end = text.indexOf("\n### ", start === -1 ? 0 : start + 1);
  return { start, end, body: text.slice(start, end) };
}

test("author-plan node mandates the plan-header **Spec:** line-2 convention", () => {
  const { start, body } = authorPlanNode(readFileSync(SKILL, "utf8"));
  expect(start !== -1, `author-plan node missing: ${SKILL}`).toBeTruthy();
  expect(body, "author-plan Do must require the **Spec:** header line").toMatch(/\*\*Spec:\*\*/);
  expect(body, "convention must pin the header line to line 2").toMatch(/line 2/);
  expect(body, "convention must link <name>-design.md").toMatch(/design\.md/);
  expect(body, "convention must record the cdd-report first-hop dependency").toMatch(
    /plan record.*first hop/,
  );
  expect(body, "deleted resolve-destination node name must not survive in author-plan").not.toMatch(
    /resolve-destination/,
  );
});
