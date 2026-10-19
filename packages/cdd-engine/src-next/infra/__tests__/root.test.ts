// packages/cdd-engine/src-next/infra/__tests__/root.test.ts
// T1 — the path value-object pair (design spec §2.2): the ONE basis authority
// (RepoRoot) + the ONE canonical shape type (RepoPath). The pins judge the pure
// relativize/resolve pair — zero syscall, zero `process.cwd()` read (the plane
// is pure string arithmetic over node:path).

import path from "node:path";
import { describe, expect, it } from "vitest";
import { type RepoPath, RepoRoot } from "../root.ts";

/** A fixed absolute root — the value object's injected basis (never a live cwd). */
const ROOT = path.resolve("/abs/r");
const root = new RepoRoot(ROOT);

describe("RepoRoot — the path-basis value object (the relativize/resolve pair)", () => {
  it("relativizes an in-repo absolute input to the branded repoRoot-relative shape", () => {
    const rel: RepoPath = root.relativize(path.join(ROOT, "docs/kairos/plans/p.md"));
    expect(rel).toBe("docs/kairos/plans/p.md");
  });

  it("relativizes a caller-relative input against the ROOT (never process.cwd())", () => {
    // A bare relative string resolves against the injected root, not the process
    // cwd — the whole point of the value object holding the basis.
    expect(root.relativize("docs/kairos/plans/p.md")).toBe("docs/kairos/plans/p.md");
  });

  it("keeps an out-of-repo input in the single relative FORM — `..` segments, never rejected", () => {
    // spec §2.10: the shape is judged, not the location. A repo-external path
    // relativizes to a relative string carrying `..` and does NOT throw.
    const rel = root.relativize(path.resolve(ROOT, "../outside/x.md"));
    expect(rel).toBe("../outside/x.md");
    expect(() => root.relativize("../outside/x.md")).not.toThrow();
  });

  it("resolve erases a RepoPath back to the absolute syscall string — the round trip is exact", () => {
    const abs = path.join(ROOT, "docs/kairos/plans/p.md");
    expect(root.resolve(root.relativize(abs))).toBe(abs);
    // resolve agrees with path.resolve(root, input) for both input forms.
    expect(root.resolve(root.relativize("docs/x.md"))).toBe(path.resolve(ROOT, "docs/x.md"));
  });

  it("normalizes the same document's absolute and relative forms to string-equal RepoPaths", () => {
    // The false-drift semantic: one document, two argv spellings → one canonical
    // shape (the same absolute/relative pair relativizes to string-equal
    // `RepoPath`s — an absolute argv and a relative argv for one file must not
    // read as two documents).
    expect(root.relativize(path.join(ROOT, "docs/kairos/plans/p.md"))).toBe(
      root.relativize("docs/kairos/plans/p.md"),
    );
    expect(root.relativize("docs/a.md")).not.toBe(root.relativize("docs/b.md"));
  });

  it("relativizes the empty input to the empty string (the root against itself)", () => {
    expect(root.relativize("")).toBe("");
  });
});
