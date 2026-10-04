// packages/cdd-engine/src/documents/__tests__/registry.test.ts — DocTypeRegistry + singleton
// contract (P1 T1; plan §T1 · design C3). The registry is the S2/S4 dispatch entry (fail-fast):
// `resolve(kind)` throws on an unknown or unregistered kind (the message carries the kind text),
// and `all()` yields the fixed iteration order [overall, plan, spec] regardless of registration
// order — the deterministic face the SchemaFactory derivation and the audit traversal iterate.
// The engine singleton (`docTypeRegistry`) exists from this module; T2 registers the three concrete
// doc types (OverallDocType / PlanDocType / PhaseSpecDocType) — the singleton is live from T2 on.
import { describe, expect, it } from "vitest";

import {
  type DocContext,
  type DocKind,
  DocType,
  type DocTypeRoute,
  type DocValidateFailure,
} from "../doctype.ts";
import { DocTypeRegistry, docTypeRegistry } from "../registry.ts";
import { DOC_WORDS } from "../words.ts";

// A minimal doc type carrying only the registry-relevant identity (kind); the abstract surface is
// exercised in the colocated doctype.test.ts.
class StubDocType extends DocType {
  detect(_fileName: string, _content: string): boolean {
    return true;
  }

  validate(_entry: string, _ctx: DocContext): DocValidateFailure[] {
    return [];
  }

  parse(_entry: string, _ctx: DocContext): unknown {
    return null;
  }

  lifecycle(_entry: string, _ctx: DocContext): unknown {
    return null;
  }

  parentChain(_entry: string, _root: string): string | null {
    return null;
  }
}

function stubDocType(kind: DocKind, route?: DocTypeRoute): StubDocType {
  return new StubDocType({
    kind,
    shape: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://oscaner.dev/schemas/cdd/stub.json",
      title: "Stub doc structure",
      description: "stub shape",
      type: "object",
      properties: {},
    },
    words: DOC_WORDS,
    instructions: [],
    refKind: { kind: "file" },
    bodyView: {
      docFamily: { label: "docs", formats: ["RETURN_JSON", "DOCS_FIX"] },
      reviews: { lensEnum: ["completeness"], ref: "doc vs spec", axesGuide: "stub axes guide" },
    },
    route: route ?? { reviewType: null, argKey: null, targetFlag: null },
  });
}

describe("DocTypeRegistry", () => {
  it("all() yields the fixed iteration order [overall, plan, spec] regardless of input order", () => {
    const spec = stubDocType("spec");
    const plan = stubDocType("plan");
    const overall = stubDocType("overall");

    const registry = new DocTypeRegistry([spec, plan, overall]);
    expect(registry.all().map((type) => type.kind)).toEqual(["overall", "plan", "spec"]);
  });

  it("all() tolerates partial registration — present kinds keep the fixed relative order", () => {
    const spec = stubDocType("spec");
    const overall = stubDocType("overall");

    const registry = new DocTypeRegistry([spec, overall]);
    expect(registry.all().map((type) => type.kind)).toEqual(["overall", "spec"]);
  });

  it("resolve returns the registered instance by kind", () => {
    const plan = stubDocType("plan");

    const registry = new DocTypeRegistry([plan]);
    expect(registry.resolve("plan")).toBe(plan);
  });

  it("resolve throws on an unregistered or unknown kind with the kind text", () => {
    const registry = new DocTypeRegistry([stubDocType("overall")]);

    expect(() => registry.resolve("plan")).toThrow(/no doc type registered for kind: plan/);
    expect(() => registry.resolve("bogus" as DocKind)).toThrow(
      /no doc type registered for kind: bogus/,
    );
  });

  it("constructor throws on a duplicate kind registration (registration integrity)", () => {
    expect(() => new DocTypeRegistry([stubDocType("plan"), stubDocType("plan")])).toThrow(
      /duplicate doc type registered for kind: plan/,
    );
  });
});

describe("docTypeRegistry singleton", () => {
  it("registers the three concrete doc types — the T2 wiring (fixed order [overall, plan, spec])", () => {
    expect(docTypeRegistry).toBeInstanceOf(DocTypeRegistry);
    expect(docTypeRegistry.all().map((type) => type.kind)).toEqual(["overall", "plan", "spec"]);
    for (const kind of ["overall", "plan", "spec"] as const) {
      expect(docTypeRegistry.resolve(kind).kind).toBe(kind);
    }
  });
});
