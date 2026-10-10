// packages/cdd-engine/src-next/contract/__tests__/project.test.ts
// T3 test suite for the projection face (contract/project.ts).
//
// The five projections (shape / schema / slices / tokens / reference) are the
// derived surfaces of the declared registries — this suite pins the brief's
// checkables through the Projector class surface (the derivation carrier
// constructed on the declared registries; its method face is
// shape/schema/slices/tokens/reference/registries, escapeRegExp private):
//   · Projector.schema — every schema is JSON-stringify-able and its bytes are
//     snapshot-pinned from the new tree's first version;
//   · Projector.shape — the shape elements correspond 1:1 with the registered
//     elements (grouped into the section skeleton), also snapshot-pinned;
//   · Projector.slices — every declared element's slice parses its own anchor;
//   · Projector.tokens / Projector.reference — both surfaces correspond 1:1
//     with the registered elements.
// Every projection is derived: the registered declaration and known-good anchor
// literals (never module output) are the independent sources of truth, so a
// hand-written copy or a derivation drift fails a byte or equality assertion.

import { describe, expect, it } from "vitest";
import type { ElementRegistry } from "../declare.ts";
import { declaredRegistries } from "../declare.ts";
import { Projector } from "../project.ts";

const DOC_KEYS = ["overall", "plan", "phaseSpec"] as const;
const REGISTRIES = [
  declaredRegistries.overall,
  declaredRegistries.plan,
  declaredRegistries.phaseSpec,
] as const satisfies readonly ElementRegistry[];

/** The shared projection carrier the suite derives every surface from. */
const PROJECTOR = new Projector(declaredRegistries);

// The exact serialization the snapshots pin: projection JSON with two-space
// indentation and exactly one trailing newline (the package's EOF-newline rule).
const serialize = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const REF_KINDS = new Set([
  "none",
  "version-lineage",
  "markdown-link",
  "phase-id",
  "issue-ref",
  "spec-ref",
  "parent-program",
  "task-id",
]);

describe("schema projection (Projector.schema)", () => {
  const schemas = PROJECTOR.schema();

  it("emits a JSON-stringify-able schema per doc type that round-trips byte-identically", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = schemas[DOC_KEYS[index]];
      expect(() => JSON.stringify(doc), `${registry.docType} stringify`).not.toThrow();
      expect(JSON.parse(serialize(doc))).toEqual(doc);
    }
  });

  it("keys its properties one-per-declared-element, in registry order", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = schemas[DOC_KEYS[index]];
      expect(Object.keys(doc.properties)).toEqual(
        registry.elements.map((element) => element.anchor),
      );
    }
  });

  it("carries the property description (presence · home · ref) and the declared value pattern", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = schemas[DOC_KEYS[index]];
      for (const element of registry.elements) {
        const property = doc.properties[element.anchor];
        expect(property.description).toBe(
          `presence: ${element.presence} · home: ${element.home} · ref: ${element.refKind}`,
        );
        expect(property.pattern).toBe(element.valuePattern);
      }
    }
  });

  it("derives the required set from the required-presence elements, in registry order", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = schemas[DOC_KEYS[index]];
      expect(doc.required).toEqual(
        registry.elements
          .filter((element) => element.presence === "required")
          .map((element) => element.anchor),
      );
    }
  });

  it("pins the schema bytes from the first version (byte snapshots)", async () => {
    for (const key of DOC_KEYS) {
      await expect(serialize(schemas[key])).toMatchFileSnapshot(
        `__snapshots__/project.schema.${key}.snap`,
      );
    }
  });
});

describe("shape projection (Projector.shape)", () => {
  const shapes = PROJECTOR.shape();

  it("corresponds 1:1 with the registered elements (a bijection over the registry rows)", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = shapes[DOC_KEYS[index]];
      const flat = doc.structure.flatMap((group) => group.elements);
      // One shape element per registered element.
      expect(flat).toHaveLength(registry.elements.length);
      const byAnchor = new Map(flat.map((element) => [element.anchor, element]));
      for (const element of registry.elements) {
        const projected = byAnchor.get(element.anchor);
        expect(projected, `${registry.docType}:${element.anchor}`).toBeDefined();
        expect(projected!.presence).toBe(element.presence);
        expect(projected!.refKind).toBe(element.refKind);
      }
      // The shape carries exactly the registry's anchors — no extra, none missing.
      expect(flat.map((element) => element.anchor).sort()).toEqual(
        registry.elements.map((element) => element.anchor).sort(),
      );
    }
  });

  it("reads as the section skeleton: non-empty groups in first home-occurrence order", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = shapes[DOC_KEYS[index]];
      const expectedGroups: string[] = [];
      const seen = new Set<string>();
      for (const element of registry.elements) {
        if (!seen.has(element.home)) {
          seen.add(element.home);
          expectedGroups.push(element.home);
        }
      }
      expect(doc.structure.map((group) => group.home)).toEqual(expectedGroups);
      expect(doc.structure).toHaveLength(seen.size);
      for (const group of doc.structure) {
        expect(group.elements.length, `${group.home} group`).toBeGreaterThan(0);
        // Each group collects its home's rows in registry order.
        expect(group.elements.map((element) => element.anchor)).toEqual(
          registry.elements
            .filter((element) => element.home === group.home)
            .map((element) => element.anchor),
        );
      }
    }
  });

  it("pins the shape bytes from the first version (byte snapshots)", async () => {
    for (const key of DOC_KEYS) {
      await expect(serialize(shapes[key])).toMatchFileSnapshot(
        `__snapshots__/project.shape.${key}.snap`,
      );
    }
  });
});

describe("slices projection (Projector.slices)", () => {
  const slices = PROJECTOR.slices();

  it("gives every declared element a slice that parses its own anchor", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = slices[DOC_KEYS[index]];
      expect(doc.slices).toHaveLength(registry.elements.length);
      for (let i = 0; i < registry.elements.length; i++) {
        const element = registry.elements[i];
        const slice = doc.slices[i];
        expect(slice.anchor).toBe(element.anchor);
        expect(slice.anchorPattern, `${registry.docType}:${element.anchor}`).toBeInstanceOf(RegExp);
        // The slice parses its anchor — the escaped anchor literal matches the anchor itself.
        expect(
          slice.anchorPattern.test(element.anchor),
          `${registry.docType}:${element.anchor} anchorPattern`,
        ).toBe(true);
      }
    }
  });

  it("derives the anchor pattern from the anchor literal (known-good escapes)", () => {
    const overall = slices.overall;
    // No metacharacters: the anchor is its own pattern.
    expect(overall.slices[0].anchorPattern.source).toBe("# Title");
    // `**Version**` — every `*` escaped.
    expect(overall.slices[1].anchorPattern.source).toBe("\\*\\*Version\\*\\*");
    // `#### [MFRBEN] group` — brackets escaped (the anchor is the English canonical;
    // the legacy zh leaf matches through the judge's canonicalize view, never here).
    const mfrben = overall.slices.find((slice) => slice.anchor === "#### [MFRBEN] group")!;
    expect(mfrben.anchorPattern.source).toBe("#### \\[MFRBEN\\] group");
  });

  it("derives the value slice from the declared value pattern", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = slices[DOC_KEYS[index]];
      for (let i = 0; i < registry.elements.length; i++) {
        const element = registry.elements[i];
        const slice = doc.slices[i];
        expect(slice.valuePattern, `${registry.docType}:${element.anchor}`).toBeInstanceOf(RegExp);
        if (element.valuePattern !== undefined) {
          expect(slice.valuePattern?.source).toBe(element.valuePattern);
        }
      }
    }
  });
});

describe("tokens projection (Projector.tokens)", () => {
  const tokens = PROJECTOR.tokens();

  it("corresponds 1:1 with the registered elements", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = tokens[DOC_KEYS[index]];
      expect(doc.tokens).toHaveLength(registry.elements.length);
      for (let i = 0; i < registry.elements.length; i++) {
        const element = registry.elements[i];
        const token = doc.tokens[i];
        expect(token.anchor).toBe(element.anchor);
        expect(token.presence).toBe(element.presence);
        expect(token.home).toBe(element.home);
        expect(token.refKind).toBe(element.refKind);
      }
    }
  });

  it("keeps the vocabulary exactly the registry's anchor set", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = tokens[DOC_KEYS[index]];
      const anchors = doc.tokens.map((token) => token.anchor);
      expect(new Set(anchors).size).toBe(anchors.length);
      expect(new Set(anchors)).toEqual(new Set(registry.elements.map((element) => element.anchor)));
    }
  });
});

describe("reference projection (Projector.reference)", () => {
  const reference = PROJECTOR.reference();

  it("corresponds 1:1 with the registered elements, carrying refKind and value pattern", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = reference[DOC_KEYS[index]];
      expect(doc.entries).toHaveLength(registry.elements.length);
      for (let i = 0; i < registry.elements.length; i++) {
        const element = registry.elements[i];
        const entry = doc.entries[i];
        expect(entry.anchor).toBe(element.anchor);
        expect(entry.refKind).toBe(element.refKind);
        if (element.valuePattern !== undefined) {
          expect(entry.valuePattern).toBe(element.valuePattern);
        }
      }
    }
  });

  it("keeps the reference vocabulary inside the declared ref kinds", () => {
    for (const [index, registry] of REGISTRIES.entries()) {
      const doc = reference[DOC_KEYS[index]];
      for (const entry of doc.entries) {
        expect(REF_KINDS.has(entry.refKind), `${registry.docType}:${entry.anchor}`).toBe(true);
      }
    }
  });
});

describe("Projector.registries — the composed five-projection surface", () => {
  it("returns all five projections derived from the individual faces", () => {
    const projected = PROJECTOR.registries();
    expect(projected.shape).toEqual(PROJECTOR.shape());
    expect(projected.schema).toEqual(PROJECTOR.schema());
    expect(projected.slices).toEqual(PROJECTOR.slices());
    expect(projected.tokens).toEqual(PROJECTOR.tokens());
    expect(projected.reference).toEqual(PROJECTOR.reference());
  });

  it("carries each doc type's declaration identity (docType field)", () => {
    const projected = PROJECTOR.registries();
    expect(projected.shape.overall.docType).toBe("overall");
    expect(projected.schema.plan.docType).toBe("plan");
    expect(projected.tokens.phaseSpec.docType).toBe("phase-spec");
  });
});
