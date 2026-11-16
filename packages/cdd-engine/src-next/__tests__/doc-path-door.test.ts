// packages/cdd-engine/src-next/__tests__/doc-path-door.test.ts
// P36 T10 — the doc-path zero-concatenation door (design spec §2.9 ④): issue #485's
// mechanism was a path built ON a document root (`<root>/<derived name>`), so the fix
// is a structural door rather than one repaired branch — a doc root may reach the
// filesystem in exactly three declared places, and any other path composition over one
// is red.
//
// The predicate is fixed by the spec: a template literal whose substitution is a doc
// root and whose next character is the separator (`${docRoots.specs}/${slug}`), or a
// `path.join` / `path.resolve` call whose arguments carry a doc-root expression. The
// whitelist is exactly three sites, and each is pinned by a needle that must still
// resolve in the live tree — a refactor that moves a site forces an explicit
// re-declaration instead of a silently wider door:
//   ① `SlugIndex`'s scan roots (`#scanRoot`'s call sites + `insideDocRoots`);
//   ② the runtime / `RepoRoot` composition (`contract/invariants.ts` `#scanRoots`);
//   ③ the namespace / segment derivation (`DOC_ROOT_NAMESPACE` / `DOC_ROOT_SEGMENTS`).
// `face/declare.ts`'s four help examples are NOT on the list: they name `--plan <path>`
// / `--spec <path>` and carry zero doc-root interpolation.
//
// Zero module-level bare functions — the judgment and its helpers are `const` arrows.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "./support/strip-comments.ts";

/** One candidate source file, as the door sees it (repo-relative path + bytes). */
type SourceSample = {
  readonly file: string;
  readonly source: string;
};

/** One violation — the file and the 1-based line carrying the composition. */
type Violation = {
  readonly file: string;
  readonly line: number;
};

/** A doc-root expression — every spelling the engine's sources can carry. */
const DOC_ROOT = /(?:ENGINE_RUNTIME\.docRoots|ENGINE_DOC_ROOTS|\bdocRoots\b)(?:\.\w+|\[[^\]]*\])?/;

/** A template literal whose substitution is a doc root and whose next character is a
 *  separator — the `${docRoots.<root>}/<name>` form. */
const TEMPLATE_BASE =
  /\$\{[^{}]*?(?:ENGINE_RUNTIME\.docRoots|ENGINE_DOC_ROOTS|\bdocRoots\b)[^{}]*?\}\s*\//;

/** The path-composition calls the predicate judges. */
const PATH_CALL = /path\.(?:join|resolve)\(/g;

/** One admitted site — the file plus the needles that pin it in the live tree. */
type Site = {
  readonly id: string;
  readonly file: string;
  readonly needles: readonly string[];
};

/** The whitelist — EXACTLY three sites (spec §2.9 ④). */
const SITES: readonly Site[] = [
  {
    id: "① SlugIndex scan roots",
    file: "infra/slug-index.ts",
    needles: [
      "SlugIndex.#scanRoot(repoRoot, ENGINE_RUNTIME.docRoots[key], fs)",
      "Object.values(ENGINE_RUNTIME.docRoots).some",
    ],
  },
  {
    id: "② runtime / RepoRoot composition",
    file: "contract/invariants.ts",
    needles: ["Object.values(ENGINE_DOC_ROOTS).map((dir) => path.join(root, dir))"],
  },
  {
    id: "③ namespace / segment derivation",
    file: "contract/invariants.ts",
    needles: [
      "const DOC_ROOT_NAMESPACE = path.dirname(ENGINE_DOC_ROOTS.specs)",
      "const DOC_ROOT_SEGMENTS = Object.values(ENGINE_DOC_ROOTS)",
    ],
  },
];

/** The interpolation opener — spelled without a literal `${` so this fixture's own
 *  source carries no template placeholder of its own (the door reads it as data). */
const OPEN = "$" + "{";

/** The 1-based line of one offset in a text. */
const lineOf = (text: string, offset: number): number => text.slice(0, offset).split("\n").length;

/** Whether one line is on the whitelist (its file's needle appears on it). */
const whitelisted = (file: string, line: string): boolean =>
  SITES.filter((site) => file.endsWith(site.file)).some((site) =>
    site.needles.some((needle) => line.includes(needle)),
  );

/** Every `path.join` / `path.resolve` call whose argument text carries a doc root. */
const calls = (sample: SourceSample, source: string): readonly Violation[] => {
  const violations: Violation[] = [];
  for (const match of source.matchAll(PATH_CALL)) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 1;
    let index = start;
    while (index < source.length && depth > 0) {
      const char = source[index];
      if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      index += 1;
    }
    const args = source.slice(start, index - 1);
    if (!DOC_ROOT.test(args)) continue;
    const line = source.split("\n")[lineOf(source, match.index ?? 0) - 1] ?? "";
    if (whitelisted(sample.file, line)) continue;
    violations.push({ file: sample.file, line: lineOf(source, match.index ?? 0) });
  }
  return violations;
};

/** The door's judgment over one sample set: every non-whitelisted doc-root path
 *  composition, with its own location. Comments are stripped first (prose may name a
 *  doc root; code may not build a path on one). */
const doorViolations = (samples: readonly SourceSample[]): readonly Violation[] => {
  const violations: Violation[] = [];
  for (const sample of samples) {
    const source = stripComments(sample.source);
    for (const [index, line] of source.split("\n").entries()) {
      if (!TEMPLATE_BASE.test(line)) continue;
      if (whitelisted(sample.file, line)) continue;
      violations.push({ file: sample.file, line: index + 1 });
    }
    violations.push(...calls(sample, source));
  }
  return violations;
};

/** `src-next` — the engine's own source plane. */
const SRC_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Every production source under `src-next` (fixtures carry no shipped literal). */
const productionSources = (): readonly SourceSample[] =>
  readdirSync(SRC_ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .filter((entry) => !entry.parentPath.includes("__tests__"))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return { file: path.slice(SRC_ROOT.length), source: readFileSync(path, "utf8") };
    });

describe("the doc-path door — zero doc-root concatenation (P36 T10 · §2.9 ④)", () => {
  it("admits the whitelisted scan root — the doc root reaches the filesystem by name", () => {
    const sample = [
      {
        file: "infra/slug-index.ts",
        source: [
          "const scanned = DOC_ROOT_KEYS.map((key) =>",
          "  SlugIndex.#scanRoot(repoRoot, ENGINE_RUNTIME.docRoots[key], fs),",
          ");",
        ].join("\n"),
      },
    ];
    expect(doorViolations(sample)).toEqual([]);
  });

  it("admits the whitelisted namespace / segment derivation", () => {
    const sample = [
      {
        file: "contract/invariants.ts",
        source: [
          "const DOC_ROOT_NAMESPACE = path.dirname(ENGINE_DOC_ROOTS.specs);",
          "const DOC_ROOT_SEGMENTS = Object.values(ENGINE_DOC_ROOTS)",
          "  .map((dir) => path.basename(dir))",
          '  .join("/");',
        ].join("\n"),
      },
    ];
    expect(doorViolations(sample)).toEqual([]);
  });

  it("flags a template built on a doc root — the #485 mechanism", () => {
    const sample = [
      {
        file: "face/declare.ts",
        source: [
          `const example = \`cdd board --plan ${OPEN}ENGINE_DOC_ROOTS.plans}/p3.md\`;`,
          `const injected = \`${OPEN}docRoots.specs}/${OPEN}slug}\`;`,
        ].join("\n"),
      },
    ];
    expect(doorViolations(sample)).toEqual([
      { file: "face/declare.ts", line: 1 },
      { file: "face/declare.ts", line: 2 },
    ]);
  });

  it("flags a `path.join` over a doc root — the same defect in another spelling", () => {
    const sample = [
      {
        file: "infra/plan-source.ts",
        source: `const specPath = path.join(ENGINE_DOC_ROOTS.specs, \`${OPEN}slug}-design.md\`);`,
      },
    ];
    expect(doorViolations(sample)).toEqual([{ file: "infra/plan-source.ts", line: 1 }]);
  });

  it("ignores a comment that names a doc root — prose is not a path", () => {
    const sample = [
      {
        file: "infra/plan-source.ts",
        source: [
          `// the plan path used to be built as ${OPEN}ENGINE_DOC_ROOTS.plans}/<slug>.md`,
          "/** `path.join(ENGINE_DOC_ROOTS.plans, slug)` was the retired derivation */",
          "const nothing = true;",
        ].join("\n"),
      },
    ];
    expect(doorViolations(sample)).toEqual([]);
  });

  it("holds the whitelist at EXACTLY three sites, each still resolvable in the tree", () => {
    expect(SITES.map((site) => site.id)).toHaveLength(3);
    const sources = productionSources();
    for (const site of SITES) {
      const source = sources.find((sample) => sample.file.endsWith(site.file));
      expect(source, `the whitelisted file ${site.file} exists`).toBeDefined();
      const text = source?.source ?? "";
      for (const needle of site.needles) {
        expect(text, `${site.id}: ${needle}`).toContain(needle);
      }
    }
  });

  it("is green over the whole production tree — zero doc-root path compositions", () => {
    expect(productionSources().length).toBeGreaterThan(0);
    expect(doorViolations(productionSources())).toEqual([]);
  });

  it("the help examples name a path placeholder, never a doc root", () => {
    const declare = productionSources().find((sample) => sample.file.endsWith("face/declare.ts"));
    expect(declare).toBeDefined();
    const text = declare?.source ?? "";
    // four examples: implement · review · base set · board
    expect(text).toContain("--plan <path>");
    expect(text).toContain("--spec <path>");
    expect(text).not.toContain("ENGINE_DOC_ROOTS");
  });
});
