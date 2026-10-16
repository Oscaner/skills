// scripts/__tests__/scan.test.ts — the scan helpers' unit coverage. The scanToken
// assertions previously lived in guard.test.ts (lines 15,102-128) before that suite
// was dissolved with the T5 validation-domain split; this suite carries the
// walkTarget / scanToken / isQuotedDataRow behavior in the class-call form
// (WalkTarget.walk · ScanToken.scan · ScanToken.isQuotedDataRow). Pure-temp fixtures —
// the scan reads a bounded temp tree, never the repo.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ScanToken, WalkTarget } from "../lib/scan.ts";

const TOKEN = "scan-probe-token";

/** Create a temp scanning root — a disposable dir under the tmp parent (the walk
 *  root the helpers join against: `path.join(root, target)` = the temp dir). */
const makeRoot = (): { root: string; dir: string } => {
  const root = tmpdir();
  const dir = mkdtempSync(path.join(root, "scan-test-"));
  return { root, dir };
};

describe("WalkTarget — the bounded file-face walk", () => {
  it("collects every file under a directory target (recursive, repo-relative)", () => {
    const { root, dir } = makeRoot();
    try {
      mkdirSync(path.join(dir, "sub"), { recursive: true });
      writeFileSync(path.join(dir, "a.ts"), "a\n", "utf8");
      writeFileSync(path.join(dir, "sub", "b.ts"), "b\n", "utf8");
      const files = WalkTarget.walk(path.basename(dir), root);
      expect(files.map((f) => path.relative(root, f)).sort()).toEqual([
        `${path.basename(dir)}/a.ts`,
        `${path.basename(dir)}/sub/b.ts`,
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns a single file for a file target and [] for a missing path", () => {
    const { root, dir } = makeRoot();
    try {
      const file = path.join(dir, "one.ts");
      writeFileSync(file, "x\n", "utf8");
      expect(WalkTarget.walk(path.relative(root, file), root)).toEqual([file]);
      expect(WalkTarget.walk(path.relative(root, path.join(dir, "nope.ts")), root)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("ScanToken — the line-level token scan + release-mask semantics", () => {
  it("builds ONE hit per token-bearing line, 1-indexed, repo-relative", () => {
    const { root, dir } = makeRoot();
    try {
      writeFileSync(
        path.join(dir, "hit.ts"),
        `const a = "${TOKEN}";\nconst b = 1;\n// ${TOKEN}\n`,
        "utf8",
      );
      const hits = ScanToken.scan([path.basename(dir)], TOKEN, root);
      expect(hits).toEqual([
        { file: `${path.basename(dir)}/hit.ts`, line: 1, text: `const a = "${TOKEN}";` },
        { file: `${path.basename(dir)}/hit.ts`, line: 3, text: `// ${TOKEN}` },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a quoted string builds a hit everywhere except the release-files' data rows", () => {
    const { root, dir } = makeRoot();
    try {
      // Outside the release homes a code string literal is a use, never a data release.
      writeFileSync(path.join(dir, "use.ts"), `const w = "${TOKEN}" + "x";\n`, "utf8");
      const hits = ScanToken.scan([path.basename(dir)], TOKEN, root);
      expect(hits.some((h) => h.file.endsWith("use.ts"))).toBe(true);

      // Inside a release home the quoted row IS the release form.
      const release = path.join(dir, "release.ts");
      writeFileSync(release, `{ token: "${TOKEN}" },\n`, "utf8");
      const relative = `${path.basename(dir)}/release.ts`;
      const withRelease = ScanToken.scan([path.basename(dir)], TOKEN, root, {
        releaseFiles: [relative],
      });
      expect(withRelease.some((h) => h.file === relative)).toBe(false);
      expect(withRelease.some((h) => h.file.endsWith("use.ts"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("excludes whole files by path prefix — the per-file skip never leaks mid-file hits", () => {
    const { root, dir } = makeRoot();
    try {
      mkdirSync(path.join(dir, "vendor"), { recursive: true });
      writeFileSync(path.join(dir, "kept.ts"), `const w = "${TOKEN}" + "y";\n`, "utf8");
      // Multiple token-bearing lines inside an excluded path — the whole file must be
      // skipped (a mid-loop break would silently drop the lines past the first hit).
      writeFileSync(
        path.join(dir, "vendor", "drop.ts"),
        `const a = "${TOKEN}" + "a";\nconst b = "${TOKEN}" + "b";\n`,
        "utf8",
      );
      const hits = ScanToken.scan([path.basename(dir)], TOKEN, root, {
        excludePaths: [`${path.basename(dir)}/vendor`],
      });
      expect(hits.some((h) => h.file.endsWith("vendor/drop.ts"))).toBe(false);
      expect(hits.some((h) => h.file.endsWith("kept.ts"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("isQuotedDataRow — a token only inside quotes is the release form, a bare restatement is not", () => {
    expect(ScanToken.isQuotedDataRow(`{ token: "${TOKEN}" },`, TOKEN)).toBe(true);
    expect(ScanToken.isQuotedDataRow(`const w = ${TOKEN} + "x";`, TOKEN)).toBe(false);
  });
});
