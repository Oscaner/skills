// packages/kairos/tests/cdd-plan-spec.test.ts — content contract for
// the F2 plan-header `spec:` front-matter convention (P6 dogfood fix).
//
// The cdd-plan `author-plan` node must mandate the plan-document header to
// carry a `spec:` front-matter key targeting the approved design doc (the
// bullet-header line-2 form retired with the front-matter flip). That link is
// real machinery, not prose:
//   - `plan-review` dispatches `cdd review --type plan --spec <spec-path>` from
//     the same approved spec (same-source pointer);
//   - cdd-report resolves program attribution through `progress.json#plan` →
//     plan-header `spec:` → overall → Related, with `progress.json#plan` as
//     the chain's first hop. The SKILL states the first hop as "the workspace
//     plan record" (guard-clean surface: orchestrating skills must not name
//     `progress.json` — AC5, residue.ts INTERNAL_DEP_RE).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, "../skills/cdd-plan/SKILL.md");

const authorPlanNode = (text: string) => {
  // The `author-plan` node block — from its H3 heading to the next H3 heading.
  const start = text.indexOf("### `author-plan`");
  const end = text.indexOf("\n### ", start === -1 ? 0 : start + 1);
  return { start, end, body: text.slice(start, end) };
};

test("author-plan node mandates the plan-header `spec:` front-matter key convention", () => {
  const { start, body } = authorPlanNode(readFileSync(SKILL, "utf8"));
  expect(start !== -1, `author-plan node missing: ${SKILL}`).toBeTruthy();
  expect(body, "author-plan Do must require the `spec:` front-matter key").toMatch(/`spec:`/);
  expect(body, "convention must mandate the design-doc target path").toMatch(/design\.md/);
  expect(body, "convention must record the cdd-report first-hop dependency").toMatch(
    /plan record.*first hop/,
  );
  expect(body, "retired bullet-header convention must not survive in author-plan").not.toMatch(
    /\*\*Spec:\*\*/,
  );
  expect(body, "deleted resolve-destination node name must not survive in author-plan").not.toMatch(
    /resolve-destination/,
  );
});
