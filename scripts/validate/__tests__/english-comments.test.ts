// scripts/validate/__tests__/english-comments.test.ts — the repo comment-language
// guard. English-primary discipline (repo CLAUDE.md): code comments are written in
// English; a CJK-prose comment is a regression. The guard is diff-bounded: it scans
// the working-tree diff's ADDED lines only (the legacy tree carries historical CJK
// comments; a whole-tree scan would be unbounded). It runs inside the scripts-unit
// block of `pnpm run validate` and the pre-commit subset — a clean CI checkout makes
// it vacuous; local development and pre-commit make it the fail-fast gate. When
// CDD_COMMENT_LANG_BASE is set (an orchestrator-controlled range base), the committed
// range diff is scanned too.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  commentUnitsOf,
  diffAddedLineSets,
  englishGuardViolations,
  hasCjkProse,
} from "../../lib/english-comments.ts";

const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);

describe("commentUnitsOf (string/template/regex-aware walker)", () => {
  it("finds line comments outside string literals", () => {
    const units = commentUnitsOf("const x = 1; // 收口态\n");
    expect(units).toHaveLength(1);
    expect(units[0].content).toContain("收口态");
    expect(units[0].startLine).toBe(1);
  });

  it("does not treat `//` inside strings, templates or regexes as a comment", () => {
    const src = [
      'const url = "http://example.com/";',
      "const tmpl = `line one",
      "// not a comment",
      "`;",
      "const re = /ab\\/\\/cd/; // real comment",
    ].join("\n");
    const units = commentUnitsOf(src);
    expect(units).toHaveLength(1); // only the trailing `// real comment`
    expect(units[0].content).toBe(" real comment");
    expect(units[0].startLine).toBe(5);
  });

  it("tracks block-comment line ranges", () => {
    const src = ["/** one", " * two", " */", "code();"].join("\n");
    const units = commentUnitsOf(src);
    expect(units).toHaveLength(1);
    expect(units[0].startLine).toBe(1);
    expect(units[0].endLine).toBe(3);
  });
});

describe("hasCjkProse", () => {
  it("flags CJK prose", () => {
    expect(hasCjkProse(" 收口态 ")).toBe(true);
    expect(hasCjkProse("判定标准② — no forwarding shells")).toBe(true);
  });

  it("allows English comments", () => {
    expect(hasCjkProse(" closure state — no forwarding shells")).toBe(false);
  });

  it("masks backticked data operands", () => {
    expect(hasCjkProse(" matches `计划` in a plan doc ")).toBe(false);
    expect(hasCjkProse(" the `- **验收**:` marker ")).toBe(false);
    expect(hasCjkProse(" `计划` plus real prose 收口态")).toBe(true);
  });
});

describe("diffAddedLineSets", () => {
  it("collects added line numbers per file", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1,2 +1,3 @@",
      " keep",
      "+added-one",
      "+added-two",
      "@@ -10 +11 @@",
      "+added-three",
      "diff --git a/b.ts b/b.ts",
      "--- a/b.ts",
      "+++ b/b.ts",
      "@@ -5 +5 @@",
      "+added-b",
    ].join("\n");
    const sets = diffAddedLineSets(diff);
    const expectSorted = (f: string | undefined, want: number[]) =>
      expect([...(sets.get(f) ?? [])].sort((a, b) => a - b)).toEqual(want);
    expectSorted("a.ts", [2, 3, 11]);
    expectSorted("b.ts", [5]);
  });
});

describe("englishGuardViolations", () => {
  const sample = ["// first line", "const a = 1; // 收口态 prose", "const b = 2; // english"].join(
    "\n",
  );

  it("flags CJK comment prose on added lines", () => {
    const v = englishGuardViolations("x.ts", sample, new Set([2]));
    expect(v).toHaveLength(1);
    expect(v[0].file).toBe("x.ts");
    expect(v[0].line).toBe(2);
    expect(v[0].fragment.length).toBeGreaterThan(0);
  });

  it("ignores CJK prose on context (non-added) lines", () => {
    expect(englishGuardViolations("x.ts", sample, new Set([1]))).toEqual([]);
  });

  it("reports the comment start line of a block unit", () => {
    const src = ["/** 收口态 header", " * english", " */", "code();"].join("\n");
    const v = englishGuardViolations("x.ts", src, new Set([2]));
    expect(v).toHaveLength(1);
    expect(v[0].line).toBe(1);
  });
});

describe("repo comment-language guard (added lines only)", () => {
  const addedTargets = ["--", "*.ts", "*.mjs"];

  function workingTreeDiff(): string {
    return execFileSync("git", ["diff", "-U0", "HEAD", ...addedTargets], {
      cwd: ROOT,
      encoding: "utf8",
    }).toString();
  }

  it("the repo's changed TS surface carries zero CJK comment prose", () => {
    const base = process.env.CDD_COMMENT_LANG_BASE;
    const diffs = [workingTreeDiff()];
    if (base) {
      diffs.push(
        execFileSync("git", ["diff", "-U0", `${base}..HEAD`, ...addedTargets], {
          cwd: ROOT,
          encoding: "utf8",
        }).toString(),
      );
    }
    const violations: string[] = [];
    for (const diff of diffs) {
      const sets = diffAddedLineSets(diff);
      for (const [file, added] of sets) {
        let src: string;
        try {
          src = readFileSync(path.join(ROOT, file), "utf8");
        } catch {
          continue; // deleted files
        }
        for (const v of englishGuardViolations(file, src, added)) {
          violations.push(`${file}:${v.line} (${v.fragment})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
