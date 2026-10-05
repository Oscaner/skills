// packages/cdd-engine/src/documents/doctypes/body/__tests__/doc-body.test.ts — abstract DocBody
// contract surface (P2 T1; plan §T1). The abstract contract's existence IS the test subject, on the
// same model as documents/__tests__/doctype.test.ts: the type-level proofs are enforced by the repo
// tsc --noEmit gate (vitest's esbuild transform does not typecheck). The gate is asymmetric — it is
// compile-gated in the ADDITION direction: an abstract member ADDED to the base that the stub omits
// breaks the file's compilation, as does lifting renderBrief into the abstract face (that flips the
// keyof NotIn assertion below OFF and the file stops compiling). The REMOVAL direction (a projection
// dropped from the base while the stub retains its method) is NOT compile-detected — the stub then
// carries an ordinary method and the file still compiles, so that drift rides the review axes. The
// runtime assertions pin the construction contract: kind / description carry their injected identity
// and the projection methods are callable on the concrete type.
import { describe, expect, it } from "vitest";
import type { SchemaShape } from "../../../doctype.ts";
import {
  BODY_CONSTRAINTS_HEADING,
  BODY_CONSTRAINTS_HEADING_RE,
  DocBody,
  escapeRegExp,
  type SlicePatternSet,
} from "../doc-body.ts";

// A stub shape instance — the abstract contract test only proves the projection surface
// (implementable + callable), never the content (the concrete per-type shapes land at T2/T3).
const SHAPE: SchemaShape = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://oscaner.dev/schemas/cdd/stub-body.json",
  title: "Stub body structure",
  description: "stub body shape",
  type: "object",
  properties: {},
};

/** A minimal concrete doc body proving the abstract surface is implementable with EXACTLY the two
 *  projections + the inherited identity fields. Deliberately carries NO renderBrief member: its
 *  compiling proves the plan-only brief render surface stays OFF the abstract contract (the base
 *  never forces a body without a task brief — e.g. PhaseSpecBody — to implement one); the NotIn
 *  assertion below pins the same negative on the abstraction's keyof face. */
class StubDocBody extends DocBody {
  projectSchemaShape(): SchemaShape {
    return SHAPE;
  }

  projectSlicePatterns(): SlicePatternSet {
    return { headingRe: /^## Design$/m };
  }
}

// ---- type-level contract surface (tsc --noEmit gate; zero escape directives) ----

/** The type-level assertion carrier — `Expect<T extends true>` compiles only while its argument is
 *  exactly `true`; a flipped contract surface (a `false` argument) fails the whole file. */
type Expect<T extends true> = T;

/** Negative key-contained assertion — true while `Key` is NOT a member of `Face`'s public keys. */
type NotIn<Key extends string, Face> = Key extends keyof Face ? false : true;

// renderBrief is a PlanBody-side member — the abstract DocBody contract exposes NO brief surface.
// Drift signal: adding renderBrief to the abstract base flips NotIn to false and fails compilation.
type _renderBriefOffAbstractContract = Expect<NotIn<"renderBrief", DocBody>>;

describe("DocBody — abstract contract surface", () => {
  it("idempotent identity: kind + description carry their constructor-injected values", () => {
    const planBody = new StubDocBody({ kind: "plan", description: "the plan template prose" });
    expect(planBody.kind).toBe("plan");
    expect(planBody.description).toBe("the plan template prose");
    const specBody = new StubDocBody({
      kind: "phase-spec",
      description: "the spec template prose",
    });
    expect(specBody.kind).toBe("phase-spec");
    expect(specBody.description).toBe("the spec template prose");
  });

  it("the schema projection re-derives the injected shape (the DocType.shape source the T2/T3 switch lands)", () => {
    const body = new StubDocBody({ kind: "plan", description: "the plan template prose" });
    expect(body.projectSchemaShape()).toBe(SHAPE);
  });

  it("the slice projection exposes the parse slice regexes (keyed per concrete body — no preset keys on the abstract face)", () => {
    const body = new StubDocBody({ kind: "plan", description: "the plan template prose" });
    const patterns = body.projectSlicePatterns();
    expect(patterns.headingRe.test("## Design")).toBe(true);
    expect(patterns.headingRe.test("## Design ##")).toBe(false);
  });

  it("every slice key maps to a RegExp (SlicePatternSet — the index-shaped mapping contract)", () => {
    const patterns: SlicePatternSet = {
      headingRe: /^## Design$/m,
      acceptanceRe: /^### Acceptance criteria$/m,
    };
    expect(patterns.acceptanceRe.test("### Acceptance criteria")).toBe(true);
  });

  it("instances carry the abstract-typed identity (DocBody as the compiled-time contract face)", () => {
    const body: DocBody = new StubDocBody({ kind: "plan", description: "the plan template prose" });
    expect(body).toBeInstanceOf(DocBody);
  });

  it("the abstract gate is an addition-side compile guarantee — a member ADDED to the base that the stub omits fails the file", () => {
    // The subject is static: the StubDocBody above implements exactly the currently-declared
    // abstract members, so the file compiles. The gate fires when the base GAINS an abstract member
    // the stub omits — the stub then fails to implement it and the file stops compiling — and when
    // renderBrief is added to the base, the keyof NotIn assertion above flips to false and the file
    // stops compiling. The removal direction carries no compile signal: dropping a projection from
    // the base while the stub keeps its method leaves the file compiling with an ordinary method,
    // so that drift is caught on the review axes rather than by tsc.
  });
});

describe("the shared body-plane atoms (T5 review hardening — the parse-head single source)", () => {
  it("escapeRegExp neutralizes regex metacharacters (the leaves' parse-atom escape source)", () => {
    expect(escapeRegExp("v2.1")).toBe("v2\\.1");
    expect(escapeRegExp("C++")).toBe("C\\+\\+");
    // Plain heading literals pass through untouched (no metacharacters to escape).
    expect(escapeRegExp("## Constraints")).toBe("## Constraints");
  });

  it("BODY_CONSTRAINTS_HEADING is the single `## Constraints` byte source", () => {
    expect(BODY_CONSTRAINTS_HEADING).toBe("## Constraints");
  });

  it("BODY_CONSTRAINTS_HEADING_RE matches the Form-A heading line (derived from the literal const — trailing whitespace allowed, non-`##` levels never match)", () => {
    expect(BODY_CONSTRAINTS_HEADING_RE.test("## Constraints")).toBe(true);
    expect(BODY_CONSTRAINTS_HEADING_RE.test("## Constraints   ")).toBe(true);
    expect(BODY_CONSTRAINTS_HEADING_RE.test("### Constraints")).toBe(false);
    expect(BODY_CONSTRAINTS_HEADING_RE.test("## Constraints (Form A)")).toBe(false);
  });
});
