// packages/kairos/tests/cdd-plan-spec.test.ts — content contract for
// the plan-header `slug:` front-matter convention (P15 identity flip).
//
// The cdd-plan `author-plan` node must mandate the plan-document header to carry
// a `slug:` front-matter key inherited from the approved spec it plans — the
// identity key the engine indexes documents by (the bullet-header convention and
// the later `spec:` path key both retired). That key is real machinery, not prose:
//   - spec and plan resolve as one run (the engine keys the workspace
//     `.kairos/cdd/<slug>/` and the board entry on the declared `slug:`);
//   - the plan declares no attribution key of its own — cdd-report resolves
//     program attribution through `progress.json#plan` → the plan's `slug:` →
//     the spec of that slug → the spec's `program:` → the overall, with
//     `progress.json#plan` as the chain's first hop. The SKILL states the first
//     hop as "the workspace plan record" (orchestrating skills speak the record,
//     never the ledger file name).

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

test("author-plan node mandates the plan-header `slug:` identity key convention", () => {
  const { start, body } = authorPlanNode(readFileSync(SKILL, "utf8"));
  expect(start !== -1, `author-plan node missing: ${SKILL}`).toBeTruthy();
  expect(body, "author-plan Do must require the `slug:` front-matter key").toMatch(/`slug:`/);
  expect(body, "the slug must be inherited from the approved spec").toMatch(
    /inherited from the approved spec/,
  );
  expect(body, "the plan must not declare an attribution key of its own").toMatch(
    /no attribution key of its own/,
  );
  expect(body, "the attribution chain must resolve through the same-slug spec `program:`").toMatch(
    /`program:`/,
  );
  expect(body, "convention must record the cdd-report first-hop dependency").toMatch(
    /plan record.*first hop/,
  );
  expect(body, "retired `spec:` header key must not survive in author-plan").not.toMatch(/`spec:`/);
  expect(body, "retired attribution keys must not survive in author-plan").not.toMatch(
    /`parent-program:`|`parent-version:`/,
  );
  expect(body, "retired bullet-header convention must not survive in author-plan").not.toMatch(
    /\*\*Spec:\*\*/,
  );
  expect(body, "deleted resolve-destination node name must not survive in author-plan").not.toMatch(
    /resolve-destination/,
  );
});
