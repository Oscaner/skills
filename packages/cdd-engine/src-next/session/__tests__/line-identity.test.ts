// packages/cdd-engine/src-next/session/__tests__/line-identity.test.ts
// The three line kinds' ONE drift judgment (P21 §4.1): same identity → same, a moved
// input → drift, a different identity KIND → drift (the kind is part of the
// identity), and no record / no current read → null (only present facts land).

import { describe, expect, it } from "vitest";
import { ReviewRefs } from "../ledger.ts";
import { LineIdentity } from "../line-identity.ts";

const refs = new ReviewRefs();
const identity = new LineIdentity(refs);

describe("LineIdentity — the single drift verdict", () => {
  it("rules `same` when the recorded identity still matches the current input", () => {
    const recorded = refs.docRevision("docs/p.md", "body\n");
    const current = refs.docRevision("docs/p.md", "body\n");
    expect(identity.verdict(recorded, { ref: current })).toBe("same");
  });

  it("rules `drift` when the same-kind input moved", () => {
    const recorded = refs.docRevision("docs/p.md", "body\n");
    const current = refs.docRevision("docs/p.md", "body changed\n");
    expect(identity.verdict(recorded, { ref: current })).toBe("drift");
  });

  it("rules `drift` between two different identity kinds (the kind is the identity)", () => {
    const recorded = refs.docRevision("docs/p.md", "body\n");
    const current = refs.briefRevision("docs/p.md", "body\n");
    expect(identity.verdict(recorded, { ref: current })).toBe("drift");
  });

  it("answers null when there is no record or no current read", () => {
    const current = refs.docRevision("docs/p.md", "body\n");
    expect(identity.verdict(null, { ref: current })).toBeNull();
    expect(identity.verdict(current, null)).toBeNull();
  });
});
