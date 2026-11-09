// packages/kairos/tests/cdd-plan-spec.test.ts — content contract for the cdd-plan
// skill's node-level duties.
//
// ① The plan-header `slug:` convention (P15 identity flip): the `author-plan` node
// must mandate the plan-document header to carry a `slug:` front-matter key
// inherited from the approved spec it plans — the identity key the engine indexes
// documents by (the bullet-header convention and the later `spec:` path key both
// retired). That key is real machinery, not prose:
//   - spec and plan resolve as one run (the engine keys the workspace
//     `.kairos/cdd/<slug>/` and the board entry on the declared `slug:`);
//   - the plan declares no attribution key of its own — cdd-report resolves
//     program attribution through `progress.json#plan` → the plan's `slug:` →
//     the spec of that slug → the spec's `program:` → the overall, with
//     `progress.json#plan` as the chain's first hop. The SKILL states the first
//     hop as "the workspace plan record" (orchestrating skills speak the record,
//     never the ledger file name).
//
// ② The closed-wave discipline (P30 §2.7): the `NEXT-LOOP` hop — the skill's only
// fix-dispatch node — carries the duty that a finding on an already-closed task
// block's content face is answered by the DOCUMENT (amend it to the shipped split),
// never by moving the work. The pin slices the node segment: the `author-plan`
// node's older closed-wave line states the appending rule, so a whole-file substring
// would let the undelivered fix-hop instruction read green.

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

/** One node's segment — from its own H3 heading to the next H3 heading, or to the
 *  next H2 section when the node is the section's last (the whole file would let a
 *  sibling node's or a table's wording satisfy a pin this node must carry itself). */
const nodeText = (text: string, name: string): string => {
  const start = text.indexOf(`### \`${name}\``);
  if (start === -1) return "";
  const bounds = ["\n### ", "\n## "]
    .map((marker) => text.indexOf(marker, start + 1))
    .filter((index) => index !== -1);
  const end = bounds.length === 0 ? text.length : Math.min(...bounds);
  return text.slice(start, end);
};

/** The closed-wave discipline's two anchors (P30 §2.7) — the document is amended to
 *  the shipped split; the work is never carried across a closed task's boundary. */
const CLOSED_WAVE_ANCHORS = [
  "align with the delivered split",
  "never carry work into or out of a closed task",
] as const;

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

test("the NEXT-LOOP node carries the closed-wave discipline — a closed task block is history", () => {
  const skill = readFileSync(SKILL, "utf8");
  const node = nodeText(skill, "NEXT-LOOP");
  expect(node.length, "NEXT-LOOP node missing").toBeGreaterThan(0);
  for (const anchor of CLOSED_WAVE_ANCHORS) expect(node).toContain(anchor);
  // The duty rides the FIX HOP's own sentence: `author-plan`'s older closed-wave line
  // ("never rewrite the content of an already-closed task") states the appending rule
  // and must never satisfy this pin by itself.
  expect(authorPlanNode(skill).body).not.toContain(CLOSED_WAVE_ANCHORS[0]);
});
