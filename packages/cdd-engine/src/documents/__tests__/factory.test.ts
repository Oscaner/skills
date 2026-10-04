// packages/cdd-engine/src/documents/__tests__/factory.test.ts — the SchemaFactory diff-pin suite
// (P1 T3; plan §T3 · design C1: byte-faithful deterministic projection + the Q6 closure pin).
// Coverage:
//   - diff pins ×3: every rendered product is byte-equal (`Buffer.equals`) to its on-disk
//     config/schema/{phase-spec,plan,overall}.json golden (read in full) — the Q1 "pin-first" edge: the
//     moment the shape domain lands, the products are DERIVED, and the pin guards content drift
//     between the in-code shape and the product file (a manual file edit breaks the pin — the
//     design-drift signal);
//   - determinism: the same source renders byte-identical twice (the projection has no hidden
//     state — key order + fixed formatting only);
//   - Q6 closure: the product set is exactly the three ACTIVE doc types (overall / plan / spec);
//     add-phase-protocol / skill-anatomy are not doc types — zero factory output, and the write
//     surface lands exactly the three product files (every other schema file untouched);
//   - the write surface (writeAll into an injected temp dir) reproduces the on-disk bytes exactly.
// The round's live normalization (the first real writeAll against the source-home config/schema
// dir) makes these pins green; from then on the diff pins guard divergence only.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveResourceSrc } from "../../infra/resource.ts";
import { SchemaFactory } from "../factory.ts";
import { docTypeRegistry } from "../registry.ts";

const schemaDir = resolveResourceSrc("schema");

const factory = new SchemaFactory(docTypeRegistry);

/** The three ACTIVE schema products — the factory's total product set (the registry's three doc
 *  kinds keyed by product file: spec → phase-spec.json). add-phase-protocol / skill-anatomy never
 *  appear (Q6 closure — they are not doc types). */
const ACTIVE_PRODUCTS = ["overall", "plan", "phase-spec"] as const;

function activeProductBytes(): Record<string, Buffer> {
  const golden: Record<string, Buffer> = {};
  for (const file of ACTIVE_PRODUCTS) {
    golden[file] = readFileSync(path.join(schemaDir, `${file}.json`));
  }
  return golden;
}

describe("SchemaFactory (P1 T3)", () => {
  it("diff pins ×3: every rendered product is byte-equal to its on-disk schema file", () => {
    const products = factory.renderAll();
    for (const [file, golden] of Object.entries(activeProductBytes())) {
      expect(Buffer.from(products[file]).equals(golden)).toBe(true);
    }
    // The product set is exactly the three active files (no phantom / missing product).
    expect(Object.keys(products).sort()).toEqual([...ACTIVE_PRODUCTS].sort());
  });

  it("determinism: the same source renders byte-identical twice", () => {
    const first = factory.renderAll();
    const second = factory.renderAll();
    for (const file of ACTIVE_PRODUCTS) {
      expect(Buffer.from(second[file]).equals(Buffer.from(first[file]))).toBe(true);
    }
  });

  it("Q6 closure: the product set is the three active kinds and the write surface lands exactly those files", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "cdd-schema-factory-"));
    try {
      const written = factory.writeAll(tempDir);
      expect([...written].sort()).toEqual([...ACTIVE_PRODUCTS].sort());
      expect(readdirSync(tempDir).sort()).toEqual(["overall.json", "phase-spec.json", "plan.json"]);
      // The landed files equal the on-disk product bytes exactly (write = render, byte-faithful).
      for (const [file, golden] of Object.entries(activeProductBytes())) {
        expect(readFileSync(path.join(tempDir, `${file}.json`)).equals(golden)).toBe(true);
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
    // The factory never writes the non-doc-type schema files — they stay on disk untouched.
    for (const file of ["add-phase-protocol", "skill-anatomy"] as const) {
      expect(existsSync(path.join(schemaDir, `${file}.json`))).toBe(true);
    }
  });
});
