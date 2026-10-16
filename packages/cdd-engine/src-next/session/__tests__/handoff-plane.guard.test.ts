// packages/cdd-engine/src-next/session/__tests__/handoff-plane.guard.test.ts
// P5 — the handoff-plane audit, colocated after the D17 six-premise ownership-migration (the root
// guard's checkHandoffPlane assertion face re-homed into the session test
// plane — the engine's own suite holds the engine's own declaration checks). The
// two legs read the engine's single source (`session/handoff-schema.ts` — the
// declared writable subsets + the two projections), never a parallel table:
//
//   ① the role-distinctive exclusives — the findings exclusive (`findings`)
//      never rides the work declaration, the work exclusives (`status` /
//      `failure_category`) never ride the findings declaration (the SHARED
//      carrier rows — artifacts / notes — are both-faced by design; the
//      exclusives ARE the role);
//   ③ the prompt-injection projection — `schemaText(face)` parses byte-identically
//      to the declared node (the declaration IS the writable plane — zero
//      engine-only metadata to strip).
//
// Zero module-level bare functions — the read/scan helpers are `const` (the P5
// zero-`function`-declaration discipline).

import { describe, expect, it } from "vitest";

import { HandoffSchema } from "../handoff-schema.ts";

describe("the handoff-plane audit — the declared writable subsets (the engine's own declaration checks)", () => {
  it("① the role-distinctive exclusives — the findings exclusive never rides work; the work exclusives never ride findings", () => {
    const schema = new HandoffSchema();
    const work = schema.faceSchema("work");
    const findings = schema.faceSchema("findings");
    expect(work.properties ?? {}).not.toHaveProperty("findings");
    for (const key of ["status", "failure_category"] as const) {
      expect(findings.properties ?? {}).not.toHaveProperty(key);
    }
  });

  it("③ the prompt-injection projection — the schemaText fence parses to the declared writable subset", () => {
    const schema = new HandoffSchema();
    for (const face of ["work", "findings"] as const) {
      const text = schema.schemaText(face, false);
      const fence = text.split("```json\n")[1]?.split("\n```")[0];
      expect(fence, `the ${face} projection carries a \`\`\`json fence`).toBeDefined();
      if (fence === undefined) continue;
      const parsed = JSON.parse(fence) as unknown;
      expect(parsed, `the ${face} fence parses to the declared node`).toEqual(
        schema.faceSchema(face),
      );
    }
  });
});
