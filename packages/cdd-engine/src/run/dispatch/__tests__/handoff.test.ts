// packages/cdd-engine/src/run/dispatch/__tests__/handoff.test.ts
// The `## Handoff schema` fence's bytes, pinned — the prompt text `Handoff#sectionText`
// produces is what every dispatched child is told the engine reads back, and NOTHING else
// pins it: the render band carries the `{{HANDOFF_SCHEMA}}` slot as a placeholder, and a real
// prompt reaches only a spawned child. These four comparisons (plane × evidence arm) are the
// only byte record of the fence, so an edit to the declaration — a dropped slot, a changed
// required set, a moved paragraph — reds here instead of shipping a contract the read-back
// walk no longer matches.
//
// The recorded bytes are this pin's own: `Handoff#sectionText`'s four combinations are
// compared byte-for-byte against the literals below — 1045 · 455 · 1655 · 1065 characters
// for work/true · work/false · judge/true · judge/false.

import { describe, expect, it } from "vitest";
import { Handoff } from "../handoff.ts";

/** The paragraph every fence opens with — the engine's instruction to the child. */
const HEAD = [
  "Write the handoff draft at `OUTPUT_HANDOFF` per this writable subset — the engine validates it, then materializes the final carrier in place; fields not listed here are engine-reserved, do not write them.",
  "",
  "```json",
];

/** The evidence file's paragraph, present on the work plane's evidence arm only. */
const EVIDENCE_HEAD = [
  "",
  "The evidence file (the file named by `OUTPUT_EVIDENCE`) must comply with this schema — the engine reads it back with the same stakes:",
  "",
  "```json",
];

/** The work plane's carrier fence — `status` · `artifacts` · `notes` · `dispositions`. */
const WORK_FENCE =
  '{"type":"object","required":["status","artifacts"],"properties":{"status":{"type":"string","enum":["APPROVED","BLOCKED"]},"artifacts":{"type":"object"},"notes":{"type":"array","items":{"type":"string"}},"dispositions":{"type":"object"}}}';

/** The judge plane's carrier fence — `findings` (with its nested finding node), `artifacts`,
 *  `notes`. */
const JUDGE_FENCE =
  '{"type":"object","required":["findings"],"properties":{"findings":{"type":"array","items":{"type":"object","required":["severity","lens","summary"],"properties":{"id":{"type":"string"},"severity":{"type":"string","enum":["blocker","warn"]},"lens":{"type":"string"},"section":{"type":"string"},"line":{"type":"integer"},"summary":{"type":"string"},"fix":{"type":"string"},"impact":{"type":"object","required":["scenario"],"properties":{"scenario":{"type":"string"},"test":{"type":"string"}}},"regrade":{"type":"string"},"contract":{"type":"object","required":["path","anchor"],"properties":{"path":{"type":"string"},"anchor":{"type":"string"}}},"evidence":{"type":"object","required":["repro"],"properties":{"repro":{"type":"string"},"output":{"type":"string"}}}}}},"artifacts":{"type":"object"},"notes":{"type":"array","items":{"type":"string"}}}}';

/** The evidence file's fence — the one schema both planes show. */
const EVIDENCE_FENCE =
  '{"type":"object","required":["command","exit_code","passed","warnings_count","typecheck"],"properties":{"command":{"type":"string"},"exit_code":{"type":"integer"},"passed":{"type":"boolean"},"warnings_count":{"type":"integer"},"typecheck":{"type":"object","required":["command","exit_code","passed"],"properties":{"command":{"type":"string"},"exit_code":{"type":"integer"},"passed":{"type":"boolean"}}},"behavior_change":{"type":"boolean"}}}';

/** One arm's whole expected text, spelled out — never recomposed from the producer's own
 *  parts, so a moved paragraph is a difference and not a silent match. */
const expected = (fence: string, evidence: boolean): string =>
  [...HEAD, fence, "```", ...(evidence ? [...EVIDENCE_HEAD, EVIDENCE_FENCE, "```"] : [])].join(
    "\n",
  );

describe("the `## Handoff schema` fence the dispatch prompt carries", () => {
  it("pins the work plane's subset, with and without the evidence fence", () => {
    const withEvidence = Handoff.sectionText("work", true);
    const withoutEvidence = Handoff.sectionText("work", false);
    expect(withoutEvidence).toBe(expected(WORK_FENCE, false));
    expect(withEvidence).toBe(expected(WORK_FENCE, true));
    expect(withEvidence.length).toBe(1045);
    expect(withoutEvidence.length).toBe(455);
  });

  it("pins the judge plane's subset, with and without the evidence fence", () => {
    const withEvidence = Handoff.sectionText("judge", true);
    const withoutEvidence = Handoff.sectionText("judge", false);
    expect(withoutEvidence).toBe(expected(JUDGE_FENCE, false));
    expect(withEvidence).toBe(expected(JUDGE_FENCE, true));
    expect(withEvidence.length).toBe(1655);
    expect(withoutEvidence.length).toBe(1065);
  });

  it("shows only the slots the read-back validates — the plane's writable subset", () => {
    // The declaration is the fence's field source: every writable slot the plane declares is
    // a fence key, and the plane's required set is the fence's `required` list.
    for (const plane of ["work", "judge"] as const) {
      const fence = Handoff.sectionText(plane, false).split("```json\n")[1] ?? "";
      const node = JSON.parse(fence.slice(0, fence.indexOf("\n```"))) as {
        required: readonly string[];
        properties: Readonly<Record<string, unknown>>;
      };
      expect(Object.keys(node.properties).sort()).toEqual([...Handoff.writable(plane)].sort());
      expect([...node.required].sort()).toEqual(
        [...Handoff.writable(plane)].filter((key) => node.required.includes(key)).sort(),
      );
      expect(node.required.length).toBeGreaterThan(0);
    }
  });
});
