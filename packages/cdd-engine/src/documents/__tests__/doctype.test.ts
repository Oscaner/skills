// packages/cdd-engine/src/documents/__tests__/doctype.test.ts — abstract DocType contract surface
// (P1 T1; plan §T1). The abstract contract's existence IS the test subject: a concrete subclass
// must implement every abstract member (detect / validate / parse / lifecycle / parentChain) and
// supply the kind + five-domain fields + route metadata via constructor injection — any member
// dropped from the abstract class is a compile-time failure (the repo tsc --noEmit gate, which
// vitest's esbuild transform does not perform), and the runtime assertions below pin the
// construction contract: fields carry their injected identity and the abstract members are
// callable on the concrete type.
import { describe, expect, it } from "vitest";

import {
  type BodyViewSpec,
  type DocContext,
  type DocKind,
  type DocLifecycleFacts,
  DocType,
  type DocTypeOpts,
  type DocTypeRoute,
  type DocValidateFailure,
  type DocWords,
  type InstructionUnit,
  type RefKindSpec,
  type SchemaShape,
} from "../doctype.ts";
import { DOC_WORDS } from "../words.ts";

// A minimal concrete doc type proving the abstract surface is implementable — the file compiles
// only while every abstract member (detect / validate / parse / lifecycle / parentChain) is
// declared on the abstract class and overridden here with the full signature.
class StubDocType extends DocType {
  detect(fileName: string, _content: string): boolean {
    return fileName.endsWith(".md");
  }

  validate(_entry: string, _ctx: DocContext): DocValidateFailure[] {
    return [];
  }

  parse(_entry: string, _ctx: DocContext): unknown {
    return { parsed: true };
  }

  lifecycle(_entry: string, _ctx: DocContext): DocLifecycleFacts | null {
    return { reviewPlanLine: "" };
  }

  parentChain(entry: string, _root: string): string | null {
    return entry.endsWith("overall.md") ? null : "/w/overall.md";
  }
}

// A minimal stub shape instance with the concrete SchemaShape skeleton — the abstract contract test
// only proves field identity (constructor injection), never the content.
const SHAPE: SchemaShape = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://oscaner.dev/schemas/cdd/stub.json",
  title: "Stub doc structure",
  description: "stub shape",
  type: "object",
  properties: {},
};
// The stub words instance is the shared engine-lexicon content (the abstract contract test only
// proves field identity — constructor injection — never the content).
const WORDS: DocWords = DOC_WORDS;
const INSTRUCTIONS: InstructionUnit[] = [{ source: "stub" }];
const REF_KIND: RefKindSpec = { kind: "file" };
// The stub body view — the abstract contract test only proves field identity (constructor
// injection), never the content (the concrete per-type body views live in doctypes/body-views.ts).
const BODY_VIEW: BodyViewSpec = {
  docFamily: { label: "docs", formats: ["RETURN_JSON", "DOCS_FIX"] },
  reviews: { lensEnum: ["completeness"], ref: "doc vs spec", axesGuide: "stub axes guide" },
};
const ROUTE: DocTypeRoute = { reviewType: "plan", argKey: "plan", targetFlag: "--plan" };

function stubDocType(kind: DocKind, opts?: Partial<DocTypeOpts>): StubDocType {
  return new StubDocType({
    kind,
    shape: SHAPE,
    words: WORDS,
    instructions: INSTRUCTIONS,
    refKind: REF_KIND,
    bodyView: BODY_VIEW,
    route: ROUTE,
    ...opts,
  });
}

describe("DocType abstract contract", () => {
  it("DocKind covers the three doc kinds", () => {
    const kinds: DocKind[] = ["overall", "plan", "spec"];
    expect(kinds).toEqual(["overall", "plan", "spec"]);
  });

  it("constructor-injects the kind, five-domain fields and route metadata (identity preserved)", () => {
    const docType = stubDocType("plan");

    expect(docType.kind).toBe("plan");
    expect(docType.shape).toBe(SHAPE);
    expect(docType.words).toBe(WORDS);
    expect(docType.instructions).toBe(INSTRUCTIONS);
    expect(docType.refKind).toBe(REF_KIND);
    expect(docType.bodyView).toBe(BODY_VIEW);
    expect(docType.route).toBe(ROUTE);
  });

  it("abstract members are overridden by the concrete type and callable", () => {
    const docType = stubDocType("spec");

    expect(docType.detect("spec.md", "# content")).toBe(true);
    expect(docType.detect("plan.txt", "# content")).toBe(false);
    expect(docType.validate("/w/spec.md", { root: "/w" })).toEqual([]);
    expect(docType.parse("/w/spec.md", { root: "/w" })).toEqual({ parsed: true });
    expect(docType.lifecycle("/w/spec.md", { root: "/w" })).toEqual({ reviewPlanLine: "" });
    expect(docType.parentChain("/w/spec.md", "/w")).toBe("/w/overall.md");
  });

  it("route metadata carries the spec/plan literals and the overall null escape (no routed face)", () => {
    const overallRoute: DocTypeRoute = { reviewType: null, argKey: null, targetFlag: null };
    expect(overallRoute.reviewType).toBeNull();
    expect(overallRoute.argKey).toBeNull();
    expect(overallRoute.targetFlag).toBeNull();

    expect(stubDocType("overall", { route: overallRoute }).route).toBe(overallRoute);
  });
});
