// packages/kairos/tests/cdd-report-create-flags.test.ts
// The cdd-report filing-surface gate: every real `gh issue create` invocation
// literal in the shipped skills carries the singular `--label` (the plural
// `--labels` is not a gh flag), and the `create-issue` node resolves its label set
// against the repo's live label surface before the create call.
//
// Domicile: kairos suite (consumer-surface black box — reads the shipped SKILL.md
// prose, like the sibling skill-surface-consistency gate).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const SKILLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../skills");

/** Every shipped SKILL.md path, sorted (the closed six-skill roster on disk). */
const skillFiles = (): string[] =>
  readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(SKILLS_DIR, entry.name, "SKILL.md"))
    .filter((file) => {
      try {
        readFileSync(file);
        return true;
      } catch {
        return false;
      }
    })
    .sort();

/** The cdd-report SKILL.md body — the filing surface this gate pins. */
const reportSkill = (): string =>
  readFileSync(path.join(SKILLS_DIR, "cdd-report", "SKILL.md"), "utf8");

/** The `### `create-issue`` node body — from its heading to the next node heading. */
const createIssueNode = (text: string): string => {
  const start = text.indexOf("### `create-issue`\n");
  if (start < 0) throw new Error("cdd-report SKILL.md declares no `create-issue` node");
  const end = text.indexOf("\n### `", start + 1);
  return text.slice(start, end < 0 ? undefined : end);
};

/** Every REAL `gh issue create …` invocation literal (a `--repo`-carrying backticked
 *  command), per skill file — a bare `gh issue create` prose mention is not a call. */
const createLiterals = (): { file: string; literal: string }[] =>
  skillFiles().flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/gh issue create[^`\n]*/g)]
      .map((match) => match[0])
      .filter((literal) => literal.includes("--repo"))
      .map((literal) => ({ file: path.relative(SKILLS_DIR, file), literal })),
  );

test("every `gh issue create` invocation literal carries the singular `--label` flag", () => {
  const literals = createLiterals();
  expect(literals.length, "no `gh issue create` invocation literal ships at all").toBeGreaterThan(
    0,
  );
  for (const { file, literal } of literals) {
    expect(literal.includes("--labels"), `${file} files with the non-existent --labels flag`).toBe(
      false,
    );
    expect(literal.includes("--label "), `${file} names no singular --label flag`).toBe(true);
  }
});

test("the create-issue node resolves its label set against the repo's live label surface", () => {
  const node = createIssueNode(reportSkill());
  expect(node, "the create-issue node runs no `gh label list` pre-check").toContain(
    "gh label list --repo Oscaner/skills",
  );
  // The resolution degrades rather than blocks — the label set shrinks to what the
  // repo carries, and an empty intersection still files the issue.
  expect(node).toMatch(/creates the issue with no label/i);
});
