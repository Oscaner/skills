// packages/cdd-engine/src-next/contract/__tests__/declare.test.ts
// T2 test suite for the element-registry declaration (contract/declare.ts).
//
// The declare module is the doc contract's single declaration: one typed
// registry per doc type (overall-spec / plan / phase-spec / single-spec). These
// tests pin the acceptance gates of the declared data — every full doc type
// carrying at least MIN_ELEMENTS registered elements (single-spec is the declared
// lightweight exception, exempted by name), each doc type's body side
// (non-frontmatter homes) kept within MAX_BODY_ELEMENTS and its header side
// (the frontmatter surface) within MAX_HEADER_ELEMENTS, every element carrying
// all five fields (anchor · presence · value pattern · ref kind · home), the
// presence and ref-kind vocabularies staying inside their legal domains, and
// anchors unique per registry — plus the
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
import { declaredRegistries, RegistryGuard } from "../declare.ts";

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
  "frontmatter",
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
/** The body-side element gate — every non-frontmatter home (section / facet / table /
 *  graph / task-block / task-field / task-step / design-body / conditional) tallies into
 *  the body side; a doc type's body side must stay at or below this count. The value (40)
 *  keeps today's live body-side highs (overall-spec 34 · plan 22 · phase-spec 18 ·
 *  single-spec 8) inside the gate with the post-migration additions' margin. */
const MAX_BODY_ELEMENTS = 40;
/** The header-side element gate — the frontmatter surface (H1 + metadata rows). Today's
 *  live header counts run overall-spec 5 / plan 6 / phase-spec 7 / single-spec 5; 12 keeps
 *  the post-migration header additions inside the gate with margin. */
const MAX_HEADER_ELEMENTS = 12;
/** The two home partitions — the header side is the single `frontmatter` surface; the body
 *  side is every remaining declared home (derived from HOME_VALUES, so a newly declared
 *  home is classified body-side until explicitly moved into the header partition). */
const HEADER_HOMES: ReadonlySet<Home> = new Set(["frontmatter"]);
const BODY_HOMES: ReadonlySet<Home> = new Set(
  HOME_VALUES.filter((home) => !HEADER_HOMES.has(home)),
);
/** Count the elements of a registry whose home falls inside the given partition. */
const countByHome = (registry: ElementRegistry, homes: ReadonlySet<Home>): number =>
  registry.elements.filter((element) => homes.has(element.home)).length;
/** The declared light-weight exception — single-spec is a deliberately sparse
 *  scaffold (header five-tuple + four prose sections + the change-history trio)
 *  whose registered element set sits below the full-doc band by design
 *  (declare.ts); it is exempted from the band and pinned separately. */
const LIGHTWEIGHT_DOC_TYPES: ReadonlySet<string> = new Set(["single-spec"]);

const ALL_REGISTRIES = [
  declaredRegistries["overall-spec"],
  declaredRegistries.plan,
  declaredRegistries["phase-spec"],
  declaredRegistries["single-spec"],
] as const satisfies readonly ElementRegistry[];

describe("declared registries", () => {
  it("declares exactly the four doc types with their docType identity", () => {
    expect(declaredRegistries["overall-spec"].docType).toBe("overall-spec");
    expect(declaredRegistries.plan.docType).toBe("plan");
    expect(declaredRegistries["phase-spec"].docType).toBe("phase-spec");
    expect(declaredRegistries["single-spec"].docType).toBe("single-spec");
  });

  it("carries at least 20 elements per full doc type (acceptance count gate)", () => {
    for (const registry of ALL_REGISTRIES) {
      if (LIGHTWEIGHT_DOC_TYPES.has(registry.docType)) continue;
      expect(registry.elements.length, `${registry.docType} element count`).toBeGreaterThanOrEqual(
        MIN_ELEMENTS,
      );
    }
  });

  it("keeps the header side (frontmatter home) within MAX_HEADER_ELEMENTS per doc type", () => {
    for (const registry of ALL_REGISTRIES) {
      expect(
        countByHome(registry, HEADER_HOMES),
        `${registry.docType} header element count`,
      ).toBeLessThanOrEqual(MAX_HEADER_ELEMENTS);
    }
  });

  it("keeps the body side (every non-frontmatter home) within MAX_BODY_ELEMENTS per doc type", () => {
    for (const registry of ALL_REGISTRIES) {
      expect(
        countByHome(registry, BODY_HOMES),
        `${registry.docType} body element count`,
      ).toBeLessThanOrEqual(MAX_BODY_ELEMENTS);
    }
  });

  it("keeps the light-weight doc types below the band by design (explicit exemption)", () => {
    for (const registry of ALL_REGISTRIES) {
      if (!LIGHTWEIGHT_DOC_TYPES.has(registry.docType)) continue;
      expect(registry.elements.length, `${registry.docType} element count`).toBeLessThan(
        MIN_ELEMENTS,
      );
      expect(registry.elements.length, `${registry.docType} element count`).toBeGreaterThan(0);
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

describe("RegistryGuard type guards", () => {
  it("accepts a well-formed registry element and rejects malformed shapes", () => {
    const element = {
      anchor: "## Goal",
      presence: "required",
      valuePattern: "^## Goal$",
      refKind: "none",
      home: "facet",
    } satisfies RegistryElement;
    expect(RegistryGuard.isElement(element)).toBe(true);

    // Missing the required home surface.
    expect(
      RegistryGuard.isElement({
        anchor: "## Goal",
        presence: "required",
        valuePattern: "^## Goal$",
        refKind: "none",
      }),
    ).toBe(false);
    // Presence outside the legal domain.
    expect(
      RegistryGuard.isElement({ anchor: "## Goal", presence: "sometimes", home: "facet" }),
    ).toBe(false);
    // Empty anchor token.
    expect(RegistryGuard.isElement({ anchor: "", presence: "required", home: "facet" })).toBe(
      false,
    );
    // Ref kind outside the legal enum.
    expect(
      RegistryGuard.isElement({
        anchor: "## Goal",
        presence: "required",
        refKind: "elsewhere",
        home: "facet",
      }),
    ).toBe(false);
    // Non-object inputs.
    expect(RegistryGuard.isElement(null)).toBe(false);
    expect(RegistryGuard.isElement("## Goal")).toBe(false);
  });

  it("recognizes the four declared registries and rejects registry-shaped non-registries", () => {
    expect(RegistryGuard.isRegistry(declaredRegistries["overall-spec"])).toBe(true);
    expect(RegistryGuard.isRegistry(declaredRegistries.plan)).toBe(true);
    expect(RegistryGuard.isRegistry(declaredRegistries["phase-spec"])).toBe(true);
    expect(RegistryGuard.isRegistry(declaredRegistries["single-spec"])).toBe(true);
    // Missing the elements surface.
    expect(RegistryGuard.isRegistry({ docType: "overall-spec" })).toBe(false);
    // Unknown doc type.
    expect(RegistryGuard.isRegistry({ docType: "unknown", elements: [] })).toBe(false);
    // A registry whose element fails the element guard is not a registry.
    expect(
      RegistryGuard.isRegistry({
        docType: "overall-spec",
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
    if (RegistryGuard.isElement(candidate)) {
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
    expectTypeOf({ docType: "overall-spec" }).not.toMatchTypeOf<ElementRegistry>();
  });
});
