// packages/cdd-engine/src-next/contract/__tests__/declare.test.ts
// T2 test suite for the element-registry declaration (contract/declare.ts).
//
// The declare module is the doc contract's single declaration: one typed
// registry per doc type (overall / plan / phase-spec). These tests pin the
// acceptance gates of the declared data — every registry between 20 and 40
// elements, every element carrying all five fields (anchor · presence · value
// pattern · ref kind · home), the presence and ref-kind vocabularies staying
// inside their legal domains, and anchors unique per registry — plus the
// runtime type guards and the type-level contract surface.
//
// The legal value vocabularies are pinned here as the spec-side source of truth
// (an independent authority from the implementation): the guard or the data may
// never drift outside these domains. The negative type checks (a missing home,
// a missing elements surface) are pinned by expectTypeOf(...).not.toMatchTypeOf
// assertions: if a required field ever stopped being required, the incomplete
// shapes below would satisfy the type and the assertion itself would become a
// compile error, which the `tsc -p packages/cdd-engine --noEmit` gate fails on —
// so the compile surface is pinned even though vitest transforms types away.

import { describe, expect, expectTypeOf, it } from "vitest";
import type { ElementRegistry, Home, Presence, RefKind, RegistryElement } from "../declare.ts";
import { declaredRegistries, isElementRegistry, isRegistryElement } from "../declare.ts";

const PRESENCE_VALUES = [
  "required",
  "optional",
  "conditional",
] as const satisfies readonly Presence[];
const REF_KIND_VALUES = [
  "none",
  "version-lineage",
  "markdown-link",
  "phase-id",
  "issue-ref",
  "spec-ref",
  "parent-program",
  "task-id",
] as const satisfies readonly RefKind[];
const HOME_VALUES = [
  "header",
  "section",
  "facet",
  "table",
  "graph",
  "task-block",
  "task-field",
  "task-step",
  "design-body",
  "conditional",
] as const satisfies readonly Home[];

const MIN_ELEMENTS = 20;
const MAX_ELEMENTS = 40;

const ALL_REGISTRIES = [
  declaredRegistries.overall,
  declaredRegistries.plan,
  declaredRegistries.phaseSpec,
] as const satisfies readonly ElementRegistry[];

describe("declared registries", () => {
  it("declares exactly the three doc types with their docType identity", () => {
    expect(declaredRegistries.overall.docType).toBe("overall");
    expect(declaredRegistries.plan.docType).toBe("plan");
    expect(declaredRegistries.phaseSpec.docType).toBe("phase-spec");
  });

  it("carries between 20 and 40 elements per doc type (acceptance count gate)", () => {
    for (const registry of ALL_REGISTRIES) {
      expect(registry.elements.length, `${registry.docType} element count`).toBeGreaterThanOrEqual(
        MIN_ELEMENTS,
      );
      expect(registry.elements.length, `${registry.docType} element count`).toBeLessThanOrEqual(
        MAX_ELEMENTS,
      );
    }
  });

  it("fills all five fields on every element (anchor · presence · valuePattern · refKind · home)", () => {
    for (const registry of ALL_REGISTRIES) {
      for (const element of registry.elements) {
        expect(element.anchor.length, `${registry.docType} anchor`).toBeGreaterThan(0);
        expect(PRESENCE_VALUES, `${registry.docType}:${element.anchor} presence`).toContain(
          element.presence,
        );
        expect(
          typeof element.valuePattern,
          `${registry.docType}:${element.anchor} valuePattern`,
        ).toBe("string");
        expect(REF_KIND_VALUES, `${registry.docType}:${element.anchor} refKind`).toContain(
          element.refKind,
        );
        expect(HOME_VALUES, `${registry.docType}:${element.anchor} home`).toContain(element.home);
      }
    }
  });

  it("keeps anchors unique within each registry", () => {
    for (const registry of ALL_REGISTRIES) {
      const seen = new Set<string>();
      for (const element of registry.elements) {
        expect(
          seen.has(element.anchor),
          `${registry.docType} duplicate anchor: ${element.anchor}`,
        ).toBe(false);
        seen.add(element.anchor);
      }
    }
  });

  it("keeps the ref-kind vocabulary inside its legal enum", () => {
    const legal = new Set<unknown>(REF_KIND_VALUES);
    for (const registry of ALL_REGISTRIES) {
      for (const element of registry.elements) {
        expect(element.refKind, `${registry.docType}:${element.anchor} refKind`).toBeDefined();
        expect(legal.has(element.refKind), `${registry.docType}:${element.anchor} refKind`).toBe(
          true,
        );
      }
    }
  });
});

describe("type guards", () => {
  it("accepts a well-formed registry element and rejects malformed shapes", () => {
    const element = {
      anchor: "## Goal",
      presence: "required",
      valuePattern: "^## Goal$",
      refKind: "none",
      home: "facet",
    } satisfies RegistryElement;
    expect(isRegistryElement(element)).toBe(true);

    // Missing the required home surface.
    expect(
      isRegistryElement({
        anchor: "## Goal",
        presence: "required",
        valuePattern: "^## Goal$",
        refKind: "none",
      }),
    ).toBe(false);
    // Presence outside the legal domain.
    expect(isRegistryElement({ anchor: "## Goal", presence: "sometimes", home: "facet" })).toBe(
      false,
    );
    // Empty anchor token.
    expect(isRegistryElement({ anchor: "", presence: "required", home: "facet" })).toBe(false);
    // Ref kind outside the legal enum.
    expect(
      isRegistryElement({
        anchor: "## Goal",
        presence: "required",
        refKind: "elsewhere",
        home: "facet",
      }),
    ).toBe(false);
    // Non-object inputs.
    expect(isRegistryElement(null)).toBe(false);
    expect(isRegistryElement("## Goal")).toBe(false);
  });

  it("recognizes the three declared registries and rejects registry-shaped non-registries", () => {
    expect(isElementRegistry(declaredRegistries.overall)).toBe(true);
    expect(isElementRegistry(declaredRegistries.plan)).toBe(true);
    expect(isElementRegistry(declaredRegistries.phaseSpec)).toBe(true);
    // Missing the elements surface.
    expect(isElementRegistry({ docType: "overall" })).toBe(false);
    // Unknown doc type.
    expect(isElementRegistry({ docType: "unknown", elements: [] })).toBe(false);
    // A registry whose element fails the element guard is not a registry.
    expect(
      isElementRegistry({
        docType: "overall",
        elements: [{ anchor: "## X", presence: "sometimes", home: "section" }],
      }),
    ).toBe(false);
  });
});

describe("type-level contract", () => {
  it("pins the legal value vocabularies as the narrow unions", () => {
    expectTypeOf<Presence>().toEqualTypeOf<"required" | "optional" | "conditional">();
    expectTypeOf<RefKind>().toEqualTypeOf<
      | "none"
      | "version-lineage"
      | "markdown-link"
      | "phase-id"
      | "issue-ref"
      | "spec-ref"
      | "parent-program"
      | "task-id"
    >();
  });

  it("narrows a guarded unknown to the registry-element contract", () => {
    const candidate: unknown = {
      anchor: "## Goal",
      presence: "required",
      valuePattern: "^## Goal$",
      refKind: "none",
      home: "facet",
    };
    if (isRegistryElement(candidate)) {
      expectTypeOf(candidate).toMatchTypeOf<RegistryElement>();
    }
  });

  it("rejects incomplete shapes at the type level (home and elements are required)", () => {
    expectTypeOf({
      anchor: "## Goal",
      presence: "required",
      valuePattern: "^## Goal$",
      refKind: "none",
    }).not.toMatchTypeOf<RegistryElement>();
    expectTypeOf({ docType: "overall" }).not.toMatchTypeOf<ElementRegistry>();
  });
});
