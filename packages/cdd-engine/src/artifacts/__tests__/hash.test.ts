// packages/cdd-engine/src/artifacts/__tests__/hash.test.ts — hashFile content-state token
// (§2.3.1: sha256 hex / missing → empty-string sentinel). P6 T24 C: hashFile re-homed from
// dispatch/review-loop.ts into artifacts/hash.ts (its single point — consumers no longer import
// dispatch for a hash); this test moved with it verbatim.

import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { hashFile } from "../hash.ts";

describe("hashFile (§2.3.1 content-state token: sha256 hex / missing → empty-string sentinel)", () => {
  it("existing file → 64-char sha256 hex", () => {
    const dir = mkdtempSync(join(tmpdir(), "hashf-"));
    const doc = join(dir, "a.md");
    writeFileSync(doc, "hello p2");
    const expectHex = createHash("sha256").update("hello p2").digest("hex");
    expect(hashFile(doc)).toBe(expectHex);
    expect(hashFile(doc)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("missing file → empty-string sentinel (never equal to any real hex)", () => {
    expect(hashFile(join(tmpdir(), `nope-p2-${Date.now()}.md`))).toBe("");
  });
  it("directory (readFileSync EISDIR) → empty-string sentinel (read failures unify to the sentinel)", () => {
    expect(hashFile(tmpdir())).toBe("");
  });
});
