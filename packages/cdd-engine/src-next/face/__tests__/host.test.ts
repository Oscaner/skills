// packages/cdd-engine/src-next/face/__tests__/host.test.ts
// T21 harness-contract suite — the typed host-adaptation data plane (T25 added):
//   · the capabilities per-harness declaration — one typed data column per host
//     row (claude = the measured parallel sub-agent face, true; cursor/pi = the
//     not-yet-exercised pending marker — the per-tested stance), zero prose.
// The ordered skill chains self-test (T25) was retired with the ordered-chain data
// plane (P5 — zero consumers; the per-harness slash rendering is REFS-owned,
// audited by the guard's checkChannels derivation).

import { describe, expect, it } from "vitest";
import { HOSTS } from "../host.ts";

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

describe("the claude system-prompt stability flag", () => {
  it("claude dispatches with the dynamic system-prompt sections excluded — the other hosts declare no such capability", () => {
    expect(HOSTS.claude.invoke).toContain("--exclude-dynamic-system-prompt-sections");
    expect(HOSTS.cursor.invoke).not.toContain("--exclude-dynamic-system-prompt-sections");
    expect(HOSTS.pi.invoke).not.toContain("--exclude-dynamic-system-prompt-sections");
  });
});
