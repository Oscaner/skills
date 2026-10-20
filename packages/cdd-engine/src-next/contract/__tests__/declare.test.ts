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
import type {
  DocType,
  ElementRegistry,
  Home,
  Presence,
  RefKind,
  RegistryElement,
} from "../declare.ts";
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
  "slug-ref",
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

describe("frontmatter header-key contract (spec §2.3 / §3.3)", () => {
  // The canonical per-type front-matter key set of the contraction table (§2.3):
  // plan deliberately omits `status`/`author` (no plan head carries either row),
  // single-spec adds the optional `issues` key, phase-spec alone carries
  // `program:` and the optional `parent-version`. The order mirrors the §2.1
  // front-matter emission shapes (the migrated corpus order).
  const HEADER_KEYS: Record<DocType, readonly string[]> = {
    "overall-spec": ["title", "doc-type", "version", "date", "slug", "status", "author"],
    plan: ["title", "doc-type", "version", "date", "slug", "depends-on", "base"],
    "phase-spec": [
      "title",
      "doc-type",
      "version",
      "date",
      "slug",
      "program",
      "status",
      "author",
      "parent-version",
      "depends-on",
    ],
    "single-spec": [
      "title",
      "doc-type",
      "version",
      "date",
      "slug",
      "status",
      "author",
      "depends-on",
      "issues",
    ],
  };
  /** The closed §3.3 key vocabulary — the registry's sole legal front-matter anchor set. */
  const KEY_VOCABULARY = new Set([
    "title",
    "doc-type",
    "version",
    "date",
    "slug",
    "program",
    "status",
    "author",
    "parent-version",
    "depends-on",
    "base",
    "issues",
  ]);
  const findKey = (docType: DocType, anchor: string): RegistryElement =>
    declaredRegistries[docType].elements.find((element) => element.anchor === anchor)!;

  it("registers exactly the canonical front-matter key set per doc type, in order", () => {
    for (const registry of ALL_REGISTRIES) {
      expect(
        registry.elements
          .filter((element) => element.home === "frontmatter")
          .map((element) => element.anchor),
        `${registry.docType} header keys`,
      ).toEqual(HEADER_KEYS[registry.docType]);
    }
  });

  it("keeps every front-matter anchor inside the §3.3 key vocabulary — zero bullet/heading literals", () => {
    for (const registry of ALL_REGISTRIES) {
      for (const element of registry.elements.filter((element) => element.home === "frontmatter")) {
        expect(KEY_VOCABULARY.has(element.anchor), `${registry.docType}:${element.anchor}`).toBe(
          true,
        );
        expect(element.anchor, `${registry.docType}:${element.anchor}`).not.toMatch(/^# /);
        expect(element.anchor, `${registry.docType}:${element.anchor}`).not.toContain("**");
      }
    }
  });

  it("assigns the per-type presence per the §2.3 contraction table", () => {
    // The four-type required keys.
    for (const anchor of ["title", "doc-type", "version", "date"]) {
      for (const registry of ALL_REGISTRIES) {
        expect(findKey(registry.docType, anchor).presence, `${registry.docType}:${anchor}`).toBe(
          "required",
        );
      }
    }
    // `status`/`author` ride the three spec carriers — plan has no such key.
    for (const docType of ["overall-spec", "phase-spec", "single-spec"] as const) {
      expect(findKey(docType, "status").presence).toBe("required");
      expect(findKey(docType, "author").presence).toBe("required");
    }
    expect(declaredRegistries.plan.elements.some((element) => element.anchor === "status")).toBe(
      false,
    );
    expect(declaredRegistries.plan.elements.some((element) => element.anchor === "author")).toBe(
      false,
    );
    // `slug` is the identity key of every doc type.
    for (const registry of ALL_REGISTRIES) {
      expect(findKey(registry.docType, "slug").presence, `${registry.docType}:slug`).toBe(
        "required",
      );
      expect(findKey(registry.docType, "slug").refKind, `${registry.docType}:slug`).toBe("none");
    }
    // `program` is phase-spec-only (the parent overall's slug reference).
    expect(findKey("phase-spec", "program").presence).toBe("required");
    expect(findKey("phase-spec", "program").refKind).toBe("slug-ref");
    for (const docType of ["overall-spec", "plan", "single-spec"] as const) {
      expect(
        declaredRegistries[docType].elements.some((element) => element.anchor === "program"),
        `${docType} has no program key`,
      ).toBe(false);
    }
    // The retired path keys are gone from every registry.
    for (const docType of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
      for (const anchor of ["spec", "parent-program"]) {
        expect(
          declaredRegistries[docType].elements.some((element) => element.anchor === anchor),
          `${docType} has no ${anchor} key`,
        ).toBe(false);
      }
    }
    // `depends-on` per type.
    expect(findKey("plan", "depends-on").presence).toBe("optional");
    expect(findKey("phase-spec", "depends-on").presence).toBe("required");
    expect(findKey("single-spec", "depends-on").presence).toBe("required");
    // The optional shape-typed key: `parent-version` (phase-spec only; the plan's
    // lineage keys retired with the path-declaration face).
    expect(findKey("phase-spec", "parent-version").presence).toBe("optional");
    for (const docType of ["overall-spec", "plan", "single-spec"] as const) {
      expect(
        declaredRegistries[docType].elements.some((element) => element.anchor === "parent-version"),
        `${docType} has no parent-version key`,
      ).toBe(false);
    }
    expect(findKey("plan", "base").presence).toBe("optional");
    // `issues` is single-spec optional (the free-form's issue pointer).
    expect(findKey("single-spec", "issues").presence).toBe("optional");
    for (const docType of ["overall-spec", "plan", "phase-spec"] as const) {
      expect(
        declaredRegistries[docType].elements.some((element) => element.anchor === "issues"),
        `${docType} has no issues key`,
      ).toBe(false);
    }
  });

  it("re-shapes every front-matter value pattern as a YAML scalar (zero bullet/heading forms)", () => {
    for (const registry of ALL_REGISTRIES) {
      for (const element of registry.elements.filter((element) => element.home === "frontmatter")) {
        expect(element.valuePattern, `${registry.docType}:${element.anchor}`).toBeDefined();
        expect(element.valuePattern, `${registry.docType}:${element.anchor}`).not.toContain(
          "\\*\\*",
        );
        expect(element.valuePattern, `${registry.docType}:${element.anchor}`).not.toMatch(/^# /);
        expect(element.valuePattern, `${registry.docType}:${element.anchor}`).not.toMatch(/^- /);
      }
    }
  });

  it("matches the declared scalar shapes against known-good front-matter values", () => {
    const samples: Array<readonly [DocType, string, string]> = [
      ["overall-spec", "version", "v2.46"],
      ["plan", "version", "v0.9"],
      ["phase-spec", "version", "v1.9"],
      ["single-spec", "version", "v0.1"],
      ["overall-spec", "date", "2026-10-17"],
      ["plan", "date", "2026-10-17"],
      ["phase-spec", "date", "2026-10-17"],
      ["single-spec", "date", "2026-10-17"],
      ["overall-spec", "doc-type", "overall-spec"],
      ["plan", "doc-type", "plan"],
      ["phase-spec", "doc-type", "phase-spec"],
      ["single-spec", "doc-type", "single-spec"],
      ["overall-spec", "status", "Approved"],
      ["phase-spec", "status", "Plan pending"],
      ["single-spec", "status", "Draft"],
      ["plan", "title", "A plan title"],
      ["overall-spec", "slug", "2026-10-10-engine-doc-tooling"],
      ["plan", "slug", "2026-10-10-engine-doc-tooling-p15"],
      ["phase-spec", "slug", "2026-10-10-engine-doc-tooling-p15"],
      ["single-spec", "slug", "2026-09-28-cdd-review-contract-fix"],
      ["phase-spec", "program", "2026-10-10-engine-doc-tooling"],
      ["phase-spec", "parent-version", "v2.46"],
      ["plan", "base", "main"],
      ["phase-spec", "depends-on", "P9"],
      ["single-spec", "issues", "#302"],
      ["overall-spec", "author", "[human] · Claude Opus 5（…）"],
    ];
    for (const [docType, anchor, value] of samples) {
      const pattern = new RegExp(findKey(docType, anchor).valuePattern!);
      expect(pattern.test(value), `${docType}:${anchor} value ${JSON.stringify(value)}`).toBe(true);
    }
    // The scalar shapes are fully anchored — the retired bullet/date-combined form
    // and the empty scalar both fail.
    expect(
      new RegExp(findKey("overall-spec", "version").valuePattern!).test("v2.46 · 2026-10-17"),
    ).toBe(false);
    expect(new RegExp(findKey("plan", "title").valuePattern!).test("")).toBe(false);
  });

  it("pins the `slug:` value domain — the legal identity forms pass, the eight illegal classes fail", () => {
    const pattern = new RegExp(findKey("plan", "slug").valuePattern!);
    // The four doc types share ONE declared slug shape (one constant).
    for (const registry of ALL_REGISTRIES) {
      expect(findKey(registry.docType, "slug").valuePattern, `${registry.docType}:slug`).toBe(
        findKey("plan", "slug").valuePattern,
      );
    }
    // Legal identity values — the dotted program slug and the dated phase key.
    for (const legal of ["2026-10-10-engine-doc-tooling", "prog", "a.b_c-d", "x1"]) {
      expect(pattern.test(legal), `legal slug ${legal}`).toBe(true);
    }
    // Illegal values: the directory escapes, separators, whitespace, the empty
    // string, the over-long value and the Windows reserved characters.
    const illegal = [".", "..", "a/b", "a\\b", "a b", "", "x".repeat(129), 'a:b*?"<>|'];
    for (const value of illegal) {
      expect(pattern.test(value), `illegal slug ${JSON.stringify(value)}`).toBe(false);
    }
    // The `program:` reference shares the same value domain.
    expect(findKey("phase-spec", "program").valuePattern).toBe(
      findKey("phase-spec", "slug").valuePattern,
    );
  });

  it("reconciles the post-migration element totals against the §2.3 arithmetic (43/29/28/17)", () => {
    expect(declaredRegistries["overall-spec"].elements.length).toBe(43);
    expect(declaredRegistries.plan.elements.length).toBe(29);
    expect(declaredRegistries["phase-spec"].elements.length).toBe(28);
    expect(declaredRegistries["single-spec"].elements.length).toBe(17);
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
      | "slug-ref"
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
