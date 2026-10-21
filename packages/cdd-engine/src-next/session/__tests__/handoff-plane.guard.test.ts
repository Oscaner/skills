// packages/cdd-engine/src-next/session/__tests__/handoff-plane.guard.test.ts
// The handoff-plane audit (colocated after the D17 six-premise ownership-migration:
// the root guard's checkHandoffPlane assertion face re-homed into the session test
// plane — the engine's own suite holds the engine's own declaration checks). The two
// legs read the engine's single source (`session/handoff-schema.ts` — the projected
// writable subsets + the two projections), never a parallel table:
//
//   ① the plane-distinctive exclusives — the judge exclusive (`findings`) never
//      rides the work projection, the work exclusive (`status`) never rides the judge
//      projection (the SHARED carrier rows — artifacts / notes — are both-plane by
//      design; the exclusives ARE the plane);
//   ② the retired face vocabulary — the live engine surface carries no `"delivery"`
//      face literal (the carrier plane is `work` / `judge`, derived from the op — an
//      op-family table never re-declares it);
//   ③ the prompt-injection projection — `schemaText(plane)` parses byte-identically
//      to the projected node (the projection IS the writable plane — zero
//      engine-only metadata to strip).
//
// Zero module-level bare functions — the read/scan helpers are `const` (the P5
// zero-`function`-declaration discipline).

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { HandoffSchema } from "../handoff-schema.ts";

describe("the handoff-plane audit — the projected writable subsets (the engine's own declaration checks)", () => {
  it("① the plane-distinctive exclusives — findings never rides work; status never rides judge", () => {
    const schema = new HandoffSchema();
    const work = schema.planeSchema("work");
    const judge = schema.planeSchema("judge");
    expect(work.properties ?? {}).not.toHaveProperty("findings");
    expect(judge.properties ?? {}).not.toHaveProperty("status");
  });

  it("② the live engine surface carries no retired face literal — the carrier plane is `work` / `judge`", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const sources = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.parentPath.includes("__tests__"))
      .map((e) => join(e.parentPath, e.name));
    expect(sources.length).toBeGreaterThan(0);
    const offenders = sources.filter((p) => readFileSync(p, "utf8").includes('"delivery"'));
    expect(offenders).toEqual([]);
  });

  it("③ the prompt-injection projection — the schemaText fence parses to the projected writable subset", () => {
    const schema = new HandoffSchema();
    for (const plane of ["work", "judge"] as const) {
      const text = schema.schemaText(plane, false);
      const fence = text.split("```json\n")[1]?.split("\n```")[0];
      expect(fence, `the ${plane} projection carries a \`\`\`json fence`).toBeDefined();
      if (fence === undefined) continue;
      const parsed = JSON.parse(fence) as unknown;
      expect(parsed, `the ${plane} fence parses to the projected node`).toEqual(
        schema.planeSchema(plane),
      );
    }
  });
});
