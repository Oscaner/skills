// packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts
// P37 T6 — the pin parseability gate's structural face (design spec §7.1 · §7.2 ·
// §7.4). One criterion, three corpora, two execution faces; this file owns the
// suite-side face:
//
//   · the gate can go RED and be repaired — a seeded dead markdown pin is reported,
//     and removing it clears the gate;
//   · the pin DEFINITION's three exclusions each have a pair — the exclusion form
//     reports nothing while a real dead reference in the same position does;
//   · the three SHAPES each resolve against their own corpus (a path with its line
//     bound, a bare symbol, a test title);
//   · the declared corpus is the whole docs corpus plus the README family, and its
//     file count is a constant: a document entering or leaving the corpus goes red.
//
// The corpus is NOT clean today and this file never claims it is: zero findings is the
// AFTER-migration condition (§7.3), delivered by the corpus migration. What is pinned
// here is that the gate judges the corpus at all — a scan whose file list differs from
// the declared corpus, or a scanner that reports nothing anywhere, goes red.
//
// The other two corpora (the judged document's body, the finding's `contract.path`)
// are pinned where they execute: `face/__tests__/lifecycle.test.ts`.

import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { PinAudit, PinSpans } from "../pins.ts";

/** The repo root of THIS checkout — the guard's corpus basis. */
const REPO_ROOT = path.resolve(fileURLToPath(new URL("../../../../..", import.meta.url)));

/** The README family's package half (the `packages` tree's README files), expanded
 *  from the tree so the declaration stays a rule, never a list. */
const PACKAGE_READMES: readonly string[] = readdirSync(path.join(REPO_ROOT, "packages"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) =>
    readdirSync(path.join(REPO_ROOT, "packages", entry.name))
      .filter((name) => /^README.*\.md$/.test(name))
      .map((name) => `packages/${entry.name}/${name}`),
  );

/** The corpus declaration (§7.1) — the docs tree plus the README family, and nothing
 *  else: no baseline, no allowlist, no exemption. */
const CORPUS_ROOTS: readonly string[] = [
  "docs/kairos",
  "README.md",
  "README.zh-CN.md",
  ...PACKAGE_READMES,
];

/** The corpus size — pinned, so a document entering or leaving the corpus is red. */
const CORPUS_SIZE = 79;

/** The scratch fixture's source file — the symbol index's only corpus in these cases. */
const SAMPLE_SOURCE = "export const PresentSymbol = 1;\n";

/** The scratch fixture's test file — the test-title shape's only corpus. */
const SAMPLE_TEST = 'it("a declared test title", () => {});\n';

/** A dead reference in the migration's own shape — the `-overall.md` suffix that the
 *  template exclusion must NOT swallow (§7.3's renamed-charter path). */
const STALE_CHARTER_REFERENCE = "docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md";

interface Scratch {
  readonly root: string;
  readonly audit: PinAudit;
  readonly write: (rel: string, text: string) => void;
  readonly cleanup: () => void;
}

/** A hermetic repo — a docs tree, one source file and one test file. */
const scratch = (): Scratch => {
  const root = mkdtempSync(path.join(tmpdir(), "pin-gate-"));
  mkdirSync(path.join(root, "docs", "kairos", "plans"), { recursive: true });
  mkdirSync(path.join(root, "packages", "cdd-engine", "src-next", "__tests__"), {
    recursive: true,
  });
  writeFileSync(
    path.join(root, "packages", "cdd-engine", "src-next", "sample.ts"),
    SAMPLE_SOURCE,
    "utf8",
  );
  writeFileSync(
    path.join(root, "packages", "cdd-engine", "src-next", "__tests__", "sample.test.ts"),
    SAMPLE_TEST,
    "utf8",
  );
  return {
    root,
    audit: new PinAudit(root),
    write: (rel, text) => {
      const at = path.join(root, rel);
      mkdirSync(path.dirname(at), { recursive: true });
      writeFileSync(at, text, "utf8");
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

let scratchDirs: string[] = [];

const fixture = (): Scratch => {
  const f = scratch();
  scratchDirs.push(f.root);
  return f;
};

afterEach(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
  scratchDirs = [];
});

/** One markdown body over a list of inline tokens. */
const bodyOf = (tokens: readonly string[]): string =>
  `# fixture\n\n${tokens.map((token) => `- \`${token}\`\n`).join("")}`;

describe("P37 T6 — `pin-parseability`: the gate goes red on a dead pin and green once it is repaired", () => {
  it("reports the seeded dead pins and stops reporting them after the repair", () => {
    const f = fixture();
    f.write(
      "docs/kairos/plans/seeded.md",
      bodyOf(["docs/kairos/plans/absent.md", "AbsentSymbolName", "sample.ts", "PresentSymbol"]),
    );
    const red = f.audit.scan(["docs/kairos"]);
    expect(red.map((finding) => finding.pin)).toEqual([
      "docs/kairos/plans/absent.md",
      "AbsentSymbolName",
    ]);
    for (const finding of red) {
      expect(finding.summary).toContain(finding.pin);
      expect(finding.summary).toContain("resolves nowhere");
    }
    // the same position, repaired: the path exists and the symbol resolves
    f.write("docs/kairos/plans/seeded.md", bodyOf(["sample.ts", "PresentSymbol"]));
    expect(f.audit.scan(["docs/kairos"])).toEqual([]);
  });

  it("judges the three shapes on their own terms — a path's line bound, a bare symbol, a test title", () => {
    const f = fixture();
    const source = "packages/cdd-engine/src-next/sample.ts";
    const test = "packages/cdd-engine/src-next/__tests__/sample.test.ts";
    f.write(
      "docs/kairos/plans/shapes.md",
      bodyOf([
        source,
        `${source}:1`,
        `${source}:99`,
        "PresentSymbol",
        "AbsentSymbolName",
        `${test}::a declared test title`,
        `${test}::a retired test title`,
      ]),
    );
    const findings = f.audit.scan(["docs/kairos"]);
    expect(findings.map((finding) => [finding.pin, finding.shape])).toEqual([
      [`${source}:99`, "path"],
      ["AbsentSymbolName", "symbol"],
      [`${test}::a retired test title`, "test"],
    ]);
    // the line bound is judged against the file, not the number alone
    expect(findings[0]?.summary).toContain("does not exist");
    expect(findings[1]?.summary).toContain("no symbol named");
    expect(findings[2]?.summary).toContain("carries no test titled");
  });

  it("resolves DECLARATIONS, not prose — a name surviving in a comment or a guard regex is not a symbol", () => {
    const f = fixture();
    // the two places a deleted name outlives its declaration: the typed prose of a
    // comment, and a retirement guard's own regex text (the measured case — five
    // members deleted by P36 still named by the test that proves them gone)
    f.write(
      "packages/cdd-engine/src-next/retired.ts",
      [
        "// RetiredInComment",
        "const guard = /RetiredInRegex/;",
        'export const entry = "AWordTableEntry";',
        "export class PresentClass {",
        "  #presentMember(): void {}",
        "}",
        "",
      ].join("\n"),
    );
    // a string / template literal stays a declaration: this tree declares live
    // vocabulary that way (`face/words.ts` spells `CDD_BLOCKED:` as a literal,
    // `contract/lint.ts` derives `DependsOn id` from one), so blanking literals would
    // report live coordinates as dead
    const findings = f.audit.scanText(
      bodyOf([
        "RetiredInComment",
        "RetiredInRegex",
        "PresentClass",
        "#presentMember",
        "AWordTableEntry",
      ]),
      "declarations.md",
    );
    expect(findings.map((finding) => [finding.pin, finding.shape])).toEqual([
      ["RetiredInComment", "symbol"],
      ["RetiredInRegex", "symbol"],
    ]);
  });

  it("declares the whole corpus and pins its size — the docs tree plus the README family", () => {
    const audit = new PinAudit(REPO_ROOT);
    const files = audit.filesOf(CORPUS_ROOTS);
    expect(files).toHaveLength(CORPUS_SIZE);
    for (const file of files) expect(file.endsWith(".md"), file).toBe(true);
    // the corpus is judged by the same criterion the read-back uses — a scan reads
    // exactly the declared files (no second corpus, no exemption list)
    expect(audit.scan(CORPUS_ROOTS).length).toBeGreaterThan(0);
  });
});

describe("P37 T6 — the pin definition's three exclusions, each with its pair", () => {
  it("excludes the non-repo-root-relative forms — `./` · `../` · a `...` elision", () => {
    const f = fixture();
    f.write("docs/kairos/plans/rel.md", bodyOf(["./absent.md", "../absent.md", ".../absent.md"]));
    expect(f.audit.scan(["docs/kairos"])).toEqual([]);
    const shape = f.audit.scanText(bodyOf(["docs/kairos/plans/absent.md"]), "rel.md");
    expect(shape).toHaveLength(1);
  });

  it("excludes the product family by SHAPE — a machine-local artifact names no coordinate", () => {
    const f = fixture();
    f.write(
      "docs/kairos/plans/product.md",
      bodyOf([
        "progress.json",
        ".kairos/cdd/ws/base.json",
        ".kairos/cdd/ws/liveness.json",
        ".kairos/cdd/ws/in-flight.json",
        ".kairos/cdd/ws/plan-fix-1.c1.rulings.json",
        "tasks-1-fix-1-a2.c1.json",
        "tasks-<N>-<op>.json",
      ]),
    );
    expect(f.audit.scan(["docs/kairos"])).toEqual([]);
  });

  it("excludes the template family only when the token IS the entry — a real `-overall.md` path is judged", () => {
    const f = fixture();
    // the bare vocabulary words are not coordinates
    f.write("docs/kairos/plans/template.md", bodyOf(["X.md", "-overall.md", "-design.md"]));
    expect(f.audit.scan(["docs/kairos"])).toEqual([]);
    // the same SUFFIX inside a real path is a claim, and this one is dead: a suffix rule
    // would have swallowed exactly the stale charter path §7.3 migrates
    f.write("docs/kairos/plans/template.md", bodyOf([STALE_CHARTER_REFERENCE]));
    const findings = f.audit.scan(["docs/kairos"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.pin).toBe(STALE_CHARTER_REFERENCE);
    expect(findings[0]?.shape).toBe("path");
  });

  it("excludes the ephemeral `.changeset/*.md` reference — a record, not a claim", () => {
    const f = fixture();
    f.write("docs/kairos/plans/ephemeral.md", bodyOf([".changeset/p37-grading-boundary.md"]));
    expect(f.audit.scan(["docs/kairos"])).toEqual([]);
    // a dead path outside the consumed directory is still judged
    const findings = f.audit.scanText(bodyOf(["changeset/absent.md"]), "ephemeral.md");
    expect(findings).toHaveLength(1);
  });

  it("judges inline spans only — a fenced block is example code, never a claim", () => {
    const f = fixture();
    f.write(
      "docs/kairos/plans/fenced.md",
      '# fixture\n\n```json\n{ "pin": `docs/kairos/plans/absent.md` }\n```\n\n`docs/kairos/plans/absent.md`\n',
    );
    const findings = f.audit.scan(["docs/kairos"]);
    expect(findings).toHaveLength(1);
    expect(PinSpans.tokensOf("a `one` and ``two`` end")).toEqual(["one", "two"]);
  });
});
