// packages/cdd-engine/src/documents/__tests__/load-order.test.ts — the registry↔tokens load-order
// regression (P2 T2; plan §T2 · design C1 — the body-leaf binding resolves both load orders).
// DOC_TOKENS authorizes its phase-spec shape input from the body leaf (`PHASE_SPEC_BODY_SHAPE`),
// never from `docTypeRegistry`: the module graph is registry → doctypes → tokens (the doctype
// modules dereference DOC_TOKENS at module top) with no back-edge. If tokens.ts ever resolved the
// registry at module top, one of the two load orders below would TDZ — this file pins the one-way
// chain in both orders (each `vi.resetModules()` re-evaluates the graph from scratch).
import { describe, expect, it, vi } from "vitest";

describe("registry/tokens load-order regression (T2 — the body-leaf phase-spec binding)", () => {
  it("tokens-first order: DOC_TOKENS + docTypeRegistry both resolve (the leaf binding has no registry back-edge)", async () => {
    vi.resetModules();
    const tokens = await import("../tokens.ts");
    const registry = await import("../registry.ts");
    expect(tokens.DOC_TOKENS.phaseSpecVersionMark).toBe("**Version**");
    expect(registry.docTypeRegistry.resolve("spec").shape).toBeDefined();
  });

  it("registry-first order: DOC_TOKENS + docTypeRegistry both resolve (doctypes' module-top DOC_TOKENS deref does not re-enter the registry)", async () => {
    vi.resetModules();
    const registry = await import("../registry.ts");
    const tokens = await import("../tokens.ts");
    expect(tokens.DOC_TOKENS.phaseSpecVersionMark).toBe("**Version**");
    expect(registry.docTypeRegistry.resolve("spec").shape).toBeDefined();
  });
});
