// packages/cdd-engine/src/documents/__tests__/registry.test.ts — DocTypeRegistry + singleton
// contract (P1 T1; plan §T1 · design C3). The registry is the S2/S4 dispatch entry (fail-fast):
// `resolve(kind)` throws on an unknown or unregistered kind (the message carries the kind text),
// and `all()` yields the fixed iteration order [overall, plan, spec] regardless of registration
// order — the deterministic face the SchemaFactory derivation and the audit traversal iterate.
// The engine singleton (`docTypeRegistry`) exists from this module; the three concrete doc types
// land in T2 and are registered then — the P1 singleton is empty by construction (the empty-state
// assertion below doubles as the T2 wiring sentinel: registering the types turns it red).
import { describe, expect, it } from "vitest";

import {
  type DocContext,
  type DocKind,
  DocType,
  type DocTypeRoute,
  type DocValidateFailure,
} from "../doctype.ts";
import { DocTypeRegistry, docTypeRegistry } from "../registry.ts";

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
    shape: { description: "stub shape" },
    words: { reference: "contract-lexicon" },
    instructions: [],
    refKind: { kind: "file" },
    bodyView: { format: "markdown" },
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
  it("is a DocTypeRegistry, empty at P1 — T2 registers the three concrete doc types (wiring sentinel)", () => {
    expect(docTypeRegistry).toBeInstanceOf(DocTypeRegistry);
    expect(docTypeRegistry.all()).toEqual([]);
    expect(() => docTypeRegistry.resolve("overall")).toThrow(
      /no doc type registered for kind: overall/,
    );
  });
});
