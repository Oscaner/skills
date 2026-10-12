// packages/cdd-engine/src-next/session/__tests__/handoff-plane.guard.test.ts
// P5 — the handoff-plane audit, colocated after the D17 six-前提 归域 (the root
// guard's checkHandoffPlane assertion face re-homed into the session test
// plane — the engine's own suite holds the engine's own declaration checks). The
// three legs read the engine's single source (`session/handoff-schema.ts` — the
// declared writable subsets + the two projections), never a parallel table:
//
//   ① the role-distinctive exclusives — the findings exclusive (`findings`)
//      never rides the work declaration, the work exclusives (`status` /
//      `failure_category` / `changes`) never ride the findings declaration (the
//      SHARED carrier rows — artifacts / commits / notes — are both-faced by
//      design; the exclusives ARE the role);
//   ⑥ the engine-authority hygiene — the engine's write plane derives from the
//      declaration (`keyof properties ∪ engineOnly[face]`), so every declared
//      `engineOnly` key stays OUT of the child-visible writable view AND is
//      actually consumed by an engine carrier write path (a declaration claiming
//      an engine-only key the engine never writes is dead metadata);
//   ③ the prompt-injection projection — `schemaText(face)` parses byte-identically
//      to the declared node MINUS `engineOnly` (the child-visible fence never
//      shows the engine's own write keys).
//
// Zero module-level bare functions — the read/scan helpers are `const` (the P5
// zero-`function`-declaration discipline).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { HandoffSchema } from "../handoff-schema.ts";

/** The engine carrier-write path faces — the files whose carrier construction
 *  actually writes the engine-authority keys (the ⑥ authority hygiene's
 *  consumption scan: a declared engineOnly key must appear as a `carrier.<key> =`
 *  write in one of these — face/lifecycle.ts #materialize + session/run.ts
 *  #bookkeep set the conclusion below the skeleton). */
const WRITE_PATH_FACES = [
  fileURLToPath(new URL("../../face/lifecycle.ts", import.meta.url)),
  fileURLToPath(new URL("../run.ts", import.meta.url)),
];

/** RegExp-escape a literal key (the carrier-write scan quotes the declared key). */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether one write-path face carries a `carrier.<key> =` assignment. */
const carrierWrites = (file: string, key: string): boolean =>
  new RegExp(`carrier\\.\\b${escapeRegExp(key)}\\b\\s*=`).test(readFileSync(file, "utf8"));

/** The declared writable subset of a face, projected to the child-visible JSON
 *  (the engine's projection-① authority filter: declared minus engineOnly). */
const projectedOf = (schema: HandoffSchema, face: "work" | "findings"): unknown =>
  JSON.parse(
    JSON.stringify(schema.faceSchema(face), (key, value) =>
      key === "engineOnly" ? undefined : value,
    ),
  );

describe("the handoff-plane audit — the declared writable subsets (the engine's own declaration checks)", () => {
  it("① the role-distinctive exclusives — the findings exclusive never rides work; the work exclusives never ride findings", () => {
    const schema = new HandoffSchema();
    const work = schema.faceSchema("work");
    const findings = schema.faceSchema("findings");
    expect(work.properties ?? {}).not.toHaveProperty("findings");
    for (const key of ["status", "failure_category", "changes"] as const) {
      expect(findings.properties ?? {}).not.toHaveProperty(key);
    }
  });

  it("⑥ the engine-authority hygiene — a declared engineOnly key never leaks into the writable subset and is consumed by an engine write path", () => {
    const schema = new HandoffSchema();
    for (const face of ["work", "findings"] as const) {
      const node = schema.faceSchema(face);
      for (const key of node.engineOnly ?? []) {
        // The non-tautological leg — an engine-only key never ALSO becomes a
        // declared writable property (which would leak it into the child view).
        expect(node.properties ?? {}).not.toHaveProperty(key);
        // The non-tautological leg — no declared engine-only key goes unconsumed
        // by an engine carrier write path (dead authority metadata).
        expect(
          WRITE_PATH_FACES.some((file) => carrierWrites(file, key)),
          `the ${face} face's engineOnly key "${key}" has an engine carrier write site`,
        ).toBe(true);
      }
    }
  });

  it("③ the prompt-injection projection — the schemaText fence parses to the declared writable subset minus engineOnly", () => {
    const schema = new HandoffSchema();
    for (const face of ["work", "findings"] as const) {
      const text = schema.schemaText(face, false);
      const fence = text.split("```json\n")[1]?.split("\n```")[0];
      expect(fence, `the ${face} projection carries a \`\`\`json fence`).toBeDefined();
      if (fence === undefined) continue;
      const parsed = JSON.parse(fence) as unknown;
      expect(parsed, `the ${face} fence parses to the declared node minus engineOnly`).toEqual(
        projectedOf(schema, face),
      );
    }
  });
});
