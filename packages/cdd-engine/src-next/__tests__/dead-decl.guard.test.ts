// packages/cdd-engine/src-next/__tests__/dead-decl.guard.test.ts
// T14 (spec §3.4 ⑧/⑯/⑱/⑲) — the dead-declaration zero-residue gate. The T1=a
// stance is "a declaration is a fact": a field/constant/helper with zero reader is
// either deleted or given a real consumer, never left as a dead declaration.
//   · ⑧ HOSTS[*].cache — deleted (zero reader).
//   · ⑯ HandoffFamily.round/phase/fixFamily/fixTemplate/prev — deleted; the residual
//     `name` column is deleted too (the family surface is an `op.type` KEY SET — the
//     file names are the session plane's one mint, so no row spells a carrier pattern).
//   · ⑱ CRASH_TAIL_LINES — the ghost comment referencing the nonexistent symbol.
//   · ⑲ setupRepo — the zero-caller helper (kairos tests plane).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../", import.meta.url));
const read = (rel: string): string => readFileSync(`${SRC}/${rel}`, "utf8");

describe("dead-declaration zero residue (spec §3.4)", () => {
  it("⑧ the HOSTS rows carry zero cache field", () => {
    const hostSrc = read("face/host.ts");
    expect(hostSrc).not.toMatch(/\bcache\b/);
    expect(hostSrc).not.toMatch(/HostCacheSpec/);
  });

  it("⑯ the HandoffFamily interface + table carry zero dead fields", () => {
    const runtimeSrc = read("infra/runtime.ts");
    for (const dead of ["fixFamily", "fixTemplate"]) {
      expect(runtimeSrc, dead).not.toContain(dead);
    }
    // the round/phase/prev fields are gone (the family surface is a bare key set)
    expect(runtimeSrc).not.toMatch(/^\s*round:/m);
    expect(runtimeSrc).not.toMatch(/^\s*phase:/m);
    expect(runtimeSrc).not.toMatch(/^\s*prev:/m);
    // the residual `name` column is gone with it — no row spells a {placeholder}
    // carrier pattern the session plane's renderer alone may mint
    expect(runtimeSrc).not.toMatch(/^\s*name:\s*["'`]/m);
    expect(runtimeSrc).not.toContain("{tasks}");
    expect(runtimeSrc).not.toContain("{round}");
  });

  it("⑱ the CRASH_TAIL_LINES ghost symbol is gone from ledger.ts", () => {
    expect(read("session/ledger.ts")).not.toContain("CRASH_TAIL_LINES");
  });
});
