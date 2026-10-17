// packages/kairos/tests/issue-type-contract.test.ts
// T13 ⑥ (spec §3.3 ⑥) — the issue finding-type single-source consistency gate. The
// consumer `cdd-report` SKILL.md declares the renderer's stdin `type ∈ {…}` domain and
// quotes the renderer's rejection bytes, while the engine renderer
// (`render/issue-body.ts`) accepts the type set single-sourced at `face/words.ts`
// `ISSUE_TYPES` (derived from the issue-label rows). Before this gate the two declared
// the domain independently and had DRIFTED (`{bug | enhancement}` vs the engine's
// `{bug | enhancement | chore}` — a divergent error byte too). This gate pins the
// consumer declaration to the engine's single source — a drift fails here.
// Domicile: kairos suite (§3.6 — the engine ⇄ consumer ⑥ fact).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { Translator } from "../../cdd-engine/src-next/contract/translate.ts";
import { ISSUE_TYPES, Words } from "../../cdd-engine/src-next/face/words.ts";
import { IssueBodyRenderer } from "../../cdd-engine/src-next/render/issue-body.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The cdd-report SKILL.md body — the consumer declaration surface. */
const reportSkill = (): string =>
  readFileSync(path.join(HERE, "..", "skills", "cdd-report", "SKILL.md"), "utf8");

/** The `type ∈ {…}` value-domain brace group as declared in the SKILL.md. */
const declaredTypeDomain = (src: string): string[] => {
  const match = /`type ∈ \{([^}]+)\}`/.exec(src);
  if (match === null) throw new Error("cdd-report SKILL.md declares no `type ∈ {…}` domain");
  return (match[1] ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

/** The quoted rejection-byte domain from the SKILL.md's `must be one of …` example. */
const declaredErrorBytes = (src: string): string[] => {
  const match = /`findings\[0\]\.type: must be one of ([^`]+)`/.exec(src);
  if (match === null) throw new Error("cdd-report SKILL.md quotes no `must be one of …` bytes");
  return (match[1] ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

test("the engine renderer's type set derives from the single source (face/words.ts ISSUE_TYPES)", () => {
  const renderer = new IssueBodyRenderer(new Words(), new Translator(new Words()));
  expect([...renderer.types]).toEqual([...ISSUE_TYPES]);
  // The derived set is the word table's label-row type vocabulary, in row order.
  expect([...ISSUE_TYPES]).toEqual(["bug", "enhancement", "chore"]);
});

test("the cdd-report SKILL.md `type ∈ {…}` domain equals the engine's ISSUE_TYPES (single source)", () => {
  expect(declaredTypeDomain(reportSkill())).toEqual([...ISSUE_TYPES]);
});

test("the cdd-report SKILL.md quoted rejection bytes equal the renderer's actual error bytes", () => {
  const renderer = new IssueBodyRenderer(new Words(), new Translator(new Words()));
  // The renderer's real error byte: `findings[0].type: must be one of <a | b | c>`.
  const errors = renderer.validateInput({
    harness: "claude",
    findings: [
      {
        type: "bogus",
        lang: "en",
        context: "x",
        problem: "x",
        impact: "x",
        suggestedFix: "x",
        meta: { skill: "s", step: "t" },
      },
    ],
  });
  const typeError = errors.find((e) => e.startsWith("findings[0].type: must be one of "));
  expect(typeError, "the renderer rejects an unknown type with the pinned byte").toBeDefined();
  const actualBytes = (typeError ?? "")
    .replace(/^findings\[0\]\.type: must be one of /, "")
    .split("|")
    .map((part) => part.trim());
  expect(declaredErrorBytes(reportSkill())).toEqual(actualBytes);
});
