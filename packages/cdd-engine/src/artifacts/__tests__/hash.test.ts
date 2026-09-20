// packages/cdd-engine/src/artifacts/__tests__/hash.test.ts — hashFile content-state token
// (§2.3.1: sha256 hex / missing → empty-string sentinel). P6 T24 C: hashFile re-homed from
// dispatch/review-loop.ts into artifacts/hash.ts (its single point — consumers no longer import
// dispatch for a hash); this test moved with it verbatim.
import { it, expect, describe } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

import { hashFile } from "../hash.ts";

describe("hashFile（§2.3.1 内容状态 token：sha256 hex / 缺失 → 空串哨兵）", () => {
  it("真实文件 → 64-char sha256 hex", () => {
    const dir = mkdtempSync(join(tmpdir(), "hashf-"));
    const doc = join(dir, "a.md");
    writeFileSync(doc, "hello p2");
    const expectHex = createHash("sha256").update("hello p2").digest("hex");
    expect(hashFile(doc)).toBe(expectHex);
    expect(hashFile(doc)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("缺失文件 → 空串哨兵（≠ 任何真实 hex）", () => {
    expect(hashFile(join(tmpdir(), "nope-p2-" + Date.now() + ".md"))).toBe("");
  });
  it("目录（readFileSync EISDIR）→ 空串哨兵（读失败统一归哨兵）", () => {
    expect(hashFile(tmpdir())).toBe("");
  });
});