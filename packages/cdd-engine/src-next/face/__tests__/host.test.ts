// packages/cdd-engine/src-next/face/__tests__/host.test.ts
// T21 harness-contract suite — the typed host-adaptation data plane (T25 added):
//   · the capabilities per-harness declaration — one typed data column per host
//     row (claude = the measured parallel sub-agent face, true; cursor/pi = the
//     not-yet-exercised pending marker — the per-tested stance), zero prose;
//   · the ordered skill chains — every chain's ref keys render the per-harness
//     slash forms through the REFS table (claude/cursor `/<ref>` · pi `/skill:<bare>`),
//     the dual-form chain the skills consume (the cdd-dev dispatch chain, the
//     five-skill deliverable line) — a chain hop with an unregistered ref key is a
//     drift the assertions surface.

import { describe, expect, it } from "vitest";
import type { HostId, HostReferenceTable } from "../host.ts";
import { CHAINS, HOSTS, REFS } from "../host.ts";

/** The per-harness derivative form — the REFS table's declared derivation (pi the
 *  flat `/skill:<bare>` form, claude/cursor the `/namespace:skill` form). */
function formOf(ref: string, host: HostId): string {
  const resolved = (REFS as HostReferenceTable)[ref];
  if (resolved === undefined) throw new Error(`ref key unregistered: ${ref}`);
  return host === "pi" ? `/skill:${ref.split(":")[1]}` : `/${ref}`;
}

describe("the capabilities per-harness declaration (T25)", () => {
  it("every host row carries the capabilities column — claude the measured parallel face, cursor/pi the pending marker", () => {
    expect(HOSTS.claude.capabilities.parallel).toBe(true);
    expect(HOSTS.cursor.capabilities.parallel).toBe("pending");
    expect(HOSTS.pi.capabilities.parallel).toBe("pending");
    // the column is a typed row on every host — zero missing declarations
    for (const id of ["claude", "cursor", "pi"] as const) {
      expect(typeof HOSTS[id].capabilities).toBe("object");
      expect("parallel" in HOSTS[id].capabilities).toBe(true);
    }
  });
});

describe("the ordered skill chains (T25 — the chain rendering consumption)", () => {
  it("every chain hop is a registered ref key — a chain never names an unregistered ref", () => {
    for (const chain of Object.values(CHAINS)) {
      for (const ref of chain) {
        expect(REFS[ref], `chain hop "${ref}" must be registered in the refs table`).toBeDefined();
      }
    }
  });

  it("a chain renders the dual per-harness slash forms — claude/cursor /<ref> · pi /skill:<bare>", () => {
    const devLine = CHAINS.skillLine;
    const claudeForms = devLine.map((ref) => formOf(ref, "claude"));
    const cursorForms = devLine.map((ref) => formOf(ref, "cursor"));
    const piForms = devLine.map((ref) => formOf(ref, "pi"));
    expect(claudeForms).toEqual([
      "/kairos:cdd-design",
      "/kairos:cdd-spec-writer",
      "/kairos:cdd-plan",
      "/kairos:cdd-dev",
      "/kairos:cdd-close",
    ]);
    expect(cursorForms).toEqual(claudeForms);
    expect(piForms).toEqual([
      "/skill:cdd-design",
      "/skill:cdd-spec-writer",
      "/skill:cdd-plan",
      "/skill:cdd-dev",
      "/skill:cdd-close",
    ]);
  });

  it("the cdd-dev dispatch chain renders the ordered dual forms (implement → review → close)", () => {
    const chain = CHAINS.devDispatch;
    expect(chain.map((ref) => formOf(ref, "claude"))).toEqual([
      "/kairos:cdd-dev",
      "/mattpocock-skills:implement",
      "/mattpocock-skills:code-review",
      "/kairos:cdd-close",
    ]);
    expect(chain.map((ref) => formOf(ref, "pi"))).toEqual([
      "/skill:cdd-dev",
      "/skill:implement",
      "/skill:code-review",
      "/skill:cdd-close",
    ]);
  });
});
