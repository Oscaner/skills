// packages/cdd-engine/src-next/__tests__/issue-body.guard.test.ts
// T10 (spec §3.1 ① · §3.2 ⑤ · §3.4 ⑰) — the issue-body single-source gate.
//   · ① the label table lives ONLY on the word table (face/words.ts ISSUE_LABEL_WORDS,
//     the renderer's real read); the withdrawn `sectionLabels` copy in
//     templates/report/issue-body.json (which had drifted: bug.context zh
//     `## 场景` vs `## 背景`, enhancement.problem `## Gap` vs `## Current behavior`)
//     is deleted — a re-added divergent copy fails here.
//   · ⑤ the components roster in the JSON must derive EXACTLY: six kairos
//     components are `"kairos:" + SKILL_ROSTER key` (a prefix transform — the roster
//     is the engine's closed six-set, skill-anatomy.ts) plus two fixed headers
//     (`kairos (general)` / `cdd-engine`) that carry no roster source.
//   · ⑰ the orphan fields (severities / metaFields / reportDef / masterDef — zero
//     reader) are deleted.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SKILL_ANATOMY } from "../contract/skill-anatomy.ts";

const ISSUE_BODY_PATH = fileURLToPath(
  new URL("../../templates/report/issue-body.json", import.meta.url),
);

/** The shipped issue-body template — the emit-side form/component source. */
const issueBody = (): { components?: unknown } & Record<string, unknown> =>
  JSON.parse(readFileSync(ISSUE_BODY_PATH, "utf8")) as { components?: unknown } & Record<
    string,
    unknown
  >;

describe("issue-body single-source (spec §3.1 ① · §3.2 ⑤ · §3.4 ⑰)", () => {
  it("① the withdrawn sectionLabels copy is gone — the word table is the sole label source", () => {
    // The label rows live on face/words.ts (the renderer's real read). A second
    // copy here is the drift this gate bans.
    expect(issueBody()).not.toHaveProperty("sectionLabels");
  });

  it("⑰ the orphan fields carry zero residue (severities / metaFields / reportDef / masterDef)", () => {
    const meta = issueBody();
    for (const orphan of ["severities", "metaFields", "reportDef", "masterDef"]) {
      expect(meta, `${orphan} must be deleted (zero reader)`).not.toHaveProperty(orphan);
    }
  });

  it("⑤ the components roster derives — six roster-prefixed kairos keys + two fixed headers", () => {
    const components = issueBody().components as unknown[];
    expect(Array.isArray(components)).toBe(true);

    // The two fixed headers (no roster source) — declared explicitly.
    const fixed = ["kairos (general)", "cdd-engine"];
    // The six kairos components = `kairos:` + the closed six-set roster key.
    const derived = Object.keys(SKILL_ANATOMY.skills.registry).map((key) => `kairos:${key}`);

    const expected = new Set([...fixed, ...derived]);
    expect(components).toHaveLength(expected.size);
    for (const component of components) {
      expect(expected.has(String(component)), `unexpected component: ${String(component)}`).toBe(
        true,
      );
    }
    // The roster-derived half is exactly the six kairos keys (the prefix transform).
    for (const component of derived) {
      expect(components, `${component} missing from the roster`).toContain(component);
    }
  });
});
