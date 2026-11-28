// packages/cdd-engine/src/run/dispatch/__tests__/handoff-plane.guard.test.ts
// The handoff-plane audit — the declaration's own checks, read off the ONE source
// (`run/dispatch/handoff.ts`), never a parallel table:
//
//   ① the plane-distinctive exclusives: the judge exclusive (`findings`) never rides the
//      work projection, and the work exclusive (`status`) never rides the judge
//      projection. `artifacts` and `notes` are both-plane by design, so the exclusives ARE
//      the plane;
//   ② the required set is a SUBSET of the writable set on each plane — a required slot a
//      child is never shown would be an unpayable obligation;
//   ③ the retired face vocabulary: the live segment carries no `"delivery"` literal (the
//      carrier plane is `work` / `judge`, derived from the verb — never a per-family
//      declaration);
//   ④ the read-back and the writer judge the same fields the same way: a draft carrying
//      every declared slot passes, an extra child slot is accepted (and dropped by the
//      writer, which never walked it), an OWED slot's mismatch is the one shape that
//      refuses, and a DECORATIVE slot's mismatch is dropped in place — a wrong value costs
//      a field, never a round.
//
// The scan drops comments and the test plane: prose may name a retired symbol, code may
// not. Zero module-level bare functions — the helpers below are `const` arrows.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HANDOFF_KEYS, Handoff, PLANE_REQUIRED, PLANE_SLOTS } from "../handoff.ts";

/** The engine's `src` root — the scan set. */
const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Every production source under `src` (the test plane is a pin's own business). */
const productionSources = (): readonly { readonly path: string; readonly text: string }[] =>
  readdirSync(SRC_DIR, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .filter((entry) => !entry.parentPath.includes("__tests__"))
    .map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      return { path: file.slice(SRC_DIR.length + 1), text: readFileSync(file, "utf8") };
    });

describe("the handoff plane's declaration", () => {
  it("① keeps the plane exclusives exclusive", () => {
    expect(PLANE_SLOTS.work).not.toContain("findings");
    expect(PLANE_SLOTS.judge).not.toContain("status");
    // The shared slots are both-plane by design, and they are the only overlap.
    const shared = PLANE_SLOTS.work.filter((key) => PLANE_SLOTS.judge.includes(key));
    expect(shared.sort()).toEqual(["artifacts", "notes"]);
  });

  it("② owes only what the child is shown — the required set is a subset of the writable", () => {
    for (const plane of ["work", "judge"] as const) {
      for (const key of PLANE_REQUIRED[plane]) {
        expect(PLANE_SLOTS[plane]).toContain(key);
        expect(HANDOFF_KEYS).toContain(key);
      }
      expect(PLANE_SLOTS[plane].length).toBeGreaterThan(0);
    }
    // `dispositions` stays optional: the fix criterion judges its absence, never the schema.
    expect(PLANE_REQUIRED.work).not.toContain("dispositions");
  });

  it("③ carries no retired face literal on the live surface", () => {
    const sources = productionSources();
    expect(sources.length).toBeGreaterThan(20);
    const offenders = sources
      .filter((source) => source.text.includes('"delivery"'))
      .map((source) => source.path);
    expect(offenders).toEqual([]);
  });

  it("④ judges the same fields the writer is shown", () => {
    const workDraft = JSON.stringify({
      status: "APPROVED",
      artifacts: {},
      notes: [],
      dispositions: {},
    });
    const read = Handoff.read(workDraft, "work");
    expect(read.kind).toBe("compliant");
    if (read.kind !== "compliant") return;
    expect(read.dropped).toEqual([]);
    // An extra child slot is not declared on this plane, so the walk never judges it and the
    // writer drops it: the read-back accepts it with nothing to report.
    const extra = Handoff.read(
      `${JSON.stringify({ status: "APPROVED", artifacts: {}, findings: [] })}`,
      "work",
    );
    expect(extra.kind).toBe("compliant");
    if (extra.kind !== "compliant") return;
    expect(extra.dropped).toEqual([]);
    // A DECORATIVE slot's mismatch is dropped in place — the draft still passes.
    const decorative = Handoff.read(
      `${JSON.stringify({ status: "APPROVED", artifacts: {}, dispositions: [] })}`,
      "work",
    );
    expect(decorative.kind).toBe("compliant");
    if (decorative.kind !== "compliant") return;
    expect(decorative.dropped).toEqual(["dispositions"]);
    // …while an OWED slot's mismatch is the one shape that refuses.
    const missing = Handoff.read("{}", "work");
    expect(missing.kind).toBe("breached");
    if (missing.kind !== "breached") return;
    expect(missing.problems).toEqual(["status: required", "artifacts: required"]);
  });
});
