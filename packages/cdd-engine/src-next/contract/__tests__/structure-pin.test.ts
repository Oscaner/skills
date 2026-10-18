// packages/cdd-engine/src-next/contract/__tests__/structure-pin.test.ts
// T9 — the spec §6 structure pin, one case carrying the three complementary
// assertions (each catches a defect the other two would let through):
//   (a) retired literals — the seven line-anchored / hand-copied grammars the
//       front-matter + home-extractor migration deleted (task-block head,
//       task-field marker, task-step bullet, the markerValue payload slice, the
//       phase-id hand copy, the design group/item headings) are each zero-hit in
//       the parse face source;
//   (b) retained primitives — every census hit in contract/doc.ts belongs to
//       exactly one of the six preserved primitives, and the owning set equals
//       that six-primitive set (set equality over primitive identities, never a
//       line-number list — the valuePattern-application primitive has two
//       landing sites, so a count pin would drift with any rewrite). The census
//       vocabulary includes `.test(` and `.replace(` — the two keywords the
//       retired phase-id hand copy and the markerValue slice rode, without which
//       those two retirement classes would be invisible to the census;
//   (d) the registry side — every `home: "frontmatter"` anchor is a §3.3 key
//       (title / doc-type / version / date / status / author / spec /
//       parent-program / parent-version / depends-on / base / issues) and carries
//       no bullet/heading literal (a bullet-anchored header element would fail
//       the key-set membership); `Depends on ref` is zero-hit in the registry.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { declaredRegistries } from "../declare.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The parse face source — the file the retired/retained census walks. */
const DOC_SRC = readFileSync(path.resolve(HERE, "../doc.ts"), "utf8");
/** The registry source — the `Depends on ref` retirement pin's surface. */
const DECLARE_SRC = readFileSync(path.resolve(HERE, "../declare.ts"), "utf8");

/** The census vocabulary — every structural-regex / string-primitive hit the pin
 *  sees. `.test(` and `.replace(` are REQUIRED members: the retired phase-id
 *  hand copy (`:576`) rode `.test(` and the retired markerValue payload slice
 *  (`:459`) rode `.replace(` — a vocabulary missing either is blind to that
 *  retirement class (spec §6 (c)). */
const CENSUS = /RegExp|\.match\(|\.matchAll\(|\.split\(|\.test\(|\.replace\(/;

/** The six retained primitives — the identities every census hit must resolve
 *  into (spec §6 (b); `#phaseId`'s valuePattern read is the second landing site
 *  of the valuePattern-application primitive, per the same row). */
const PRIMITIVES: readonly { id: string; owns: (line: string) => boolean }[] = [
  {
    id: "heading-rank",
    owns: (line) => line.includes("/^(#+)\\s/"),
  },
  {
    id: "table-split",
    owns: (line) =>
      line.includes('.split("|")') || (line.includes("/^\\|") && line.includes(".test(trimmed)")),
  },
  {
    id: "markdown-link",
    owns: (line) =>
      line.includes("matchAll(linkPattern)") || line.includes("\\[([^\\]]*)\\]\\(([^)]+)\\)"),
  },
  {
    id: "version-token",
    owns: (line) => line.includes("matchAll(tokenPattern)") || line.includes("/v\\d+\\.\\d+/g"),
  },
  {
    id: "graph-edge",
    owns: (line) =>
      line.includes("match(edgePattern)") || line.includes("P(\\d+(?:\\.\\d+)*)\\s*->"),
  },
  {
    id: "valuePattern-application",
    owns: (line) => line.includes(".valuePattern.test(") || line.includes("pattern?.test("),
  },
];

/** The §3.3 header-key set — the key form a frontmatter-home anchor must take.
 *  (a future keyed-header addition must extend this set with the registry,
 *  never split the two declarations.) */
const FRONTMATTER_KEYS = new Set([
  "title",
  "doc-type",
  "version",
  "date",
  "status",
  "author",
  "spec",
  "parent-program",
  "parent-version",
  "depends-on",
  "base",
  "issues",
]);

test("spec §6 structure pin — retired grammars zero-hit · retained primitives set-equal · frontmatter-home anchors are keys", () => {
  // (a) the retired grammars — each absent from the parse face source.
  expect(CENSUS.test(".test("), "the census vocabulary must include `.test(`").toBe(true);
  expect(CENSUS.test(".replace("), "the census vocabulary must include `.replace(`").toBe(true);

  const retired = [
    ["task-block head grammar", /^### Task \(\d+\):/m],
    ["task-field marker grammar", /^-\s+\*\*([A-Za-z ]+)\*\*:\s*(.*)$/m],
    ["task-step bullet grammar", /^-\s+(.*)$/m],
    ["design group grammar", /^### (\d+)\.\s+(.*)$/m],
    ["design item grammar", /^#### (\d+)\.(\d+)\s+(.*)$/m],
  ] as const;
  for (const [id, pattern] of retired) {
    expect(pattern.test(DOC_SRC), `retired ${id} must be zero-hit in doc.ts`).toBe(false);
  }
  // the two hand-copied strings (spec §6 (a): the markerValue payload slice and
  // the `#phaseId` phase-token copy) — the exact retired literal text.
  expect(DOC_SRC, "retired markerValue payload slice must be zero-hit").not.toContain(
    ".replace(/^:\\s*/",
  );
  expect(DOC_SRC, "retired phase-id hand copy must be zero-hit").not.toContain(
    String.raw`/^P\d+(\.\d+)*$/`,
  );

  // (b) the retained primitives — every census hit resolves to exactly one of
  // the six, and the owning set equals the six identities.
  const hits = DOC_SRC.split("\n").filter((line) => CENSUS.test(line));
  const owners = hits.map((line) => {
    const matching = PRIMITIVES.filter((primitive) => primitive.owns(line));
    if (matching.length !== 1) {
      throw new Error(
        `census hit must belong to exactly one retained primitive: "${line}" (matches ${matching.length})`,
      );
    }
    return matching[0]!.id;
  });
  expect(
    new Set(owners),
    "the owning primitive set must equal the six retained primitives",
  ).toEqual(new Set(PRIMITIVES.map((primitive) => primitive.id)));
  // 6 primitives / 7 landing points / 8 census lines: the table-split primitive
  // is ONE landing in two lines (the separator-row guard + the split); the
  // valuePattern-application primitive has TWO landing sites (sectionConforms
  // and the rewritten #phaseId — the `落点由 1 处变 2 处` of spec §6 (b)), so the
  // remaining five primitives hold one census line each.
  const hitsPerPrimitive = new Map<string, number>();
  for (const id of owners) hitsPerPrimitive.set(id, (hitsPerPrimitive.get(id) ?? 0) + 1);
  expect(hits.length, "the migrated census line count (6 primitives / 7 landing points)").toBe(8);
  // the two double-hit primitives — valuePattern-application (sectionConforms +
  // the rewritten #phaseId — the `落点由 1 处变 2 处` of spec §6 (b)) and the
  // table-split (the separator-row guard + the split are ONE landing in two
  // census lines). The remaining four primitives hold one census line each.
  expect(hitsPerPrimitive.get("valuePattern-application")).toBe(2);
  expect(hitsPerPrimitive.get("table-split")).toBe(2);
  for (const primitive of PRIMITIVES) {
    if (primitive.id === "valuePattern-application" || primitive.id === "table-split") continue;
    expect(hitsPerPrimitive.get(primitive.id), `${primitive.id} must own one census line`).toBe(1);
  }

  // (d) the registry side — the frontmatter-home anchor set is a key set.
  const registries = [
    declaredRegistries["overall-spec"],
    declaredRegistries.plan,
    declaredRegistries["phase-spec"],
    declaredRegistries["single-spec"],
  ];
  const frontmatterAnchors: string[] = [];
  for (const registry of registries) {
    for (const element of registry.elements) {
      if (element.home !== "frontmatter") continue;
      frontmatterAnchors.push(element.anchor);
      expect(
        FRONTMATTER_KEYS.has(element.anchor),
        `frontmatter-home anchor "${element.anchor}" must be a §3.3 key`,
      ).toBe(true);
      expect(
        element.anchor,
        `frontmatter-home anchor "${element.anchor}" must carry no bullet`,
      ).not.toMatch(/\*\*/);
      expect(
        element.anchor,
        `frontmatter-home anchor "${element.anchor}" must carry no heading prefix`,
      ).not.toMatch(/^#\s/);
    }
  }
  expect(
    frontmatterAnchors.length,
    "the frontmatter-home anchor set must be non-empty",
  ).toBeGreaterThan(0);
  // the `Depends on ref` retirement — the retired phase-id reference class (spec §3.3).
  expect(DECLARE_SRC, "retired `Depends on ref` must be zero-hit in the registry").not.toContain(
    "Depends on ref",
  );
});
