// packages/cdd-engine/src-next/contract/__tests__/corpus-form-pin.test.ts
// T10 — the §5.1/§6 full-corpus migration pin. After the one-time migration
// script (deleted, never committed) rewrote the 21 in-registry corpus docs from
// old bullet headers to YAML front-matter, this permanent test holds the result
// shape: every in-registry doc's first non-empty line is the `---` fence, its
// front-matter parses to exactly the registry's frontmatter-home key set (all
// required keys present, no foreign keys), the retired header tuples are
// zero-hit across the corpus, the docs still judge to zero findings (the
// recorded pre-migration baseline was 0 → empty→empty same-set), and the
// `Issues（收口时关闭）` old-form row lands on the `issues:` key (the §2.3
// migration rule, exercised on a constructed head because the migrated corpus
// carries zero issues rows).

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { declaredRegistries } from "../declare.ts";
import { FrontMatterExtractor } from "../frontmatter.ts";
import { Contract } from "../judge.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../../..", import.meta.url));

/** The two in-registry corpus directories (§5.1). The pin tracks the LIVE corpus
 *  (docs/kairos/specs 12 + docs/kairos/plans 11 = 23 today): the migration-time
 *  snapshot was 11 + 10 = 21, and every doc landing after it is checked by the
 *  same per-doc shape loop — the counts re-anchor with the corpus, the shape does not. */
const CORPUS_DIRS = ["docs/kairos/specs", "docs/kairos/plans"] as const;

/** The §6 form-pin census pattern — the retired header tuples, zero-hit after
 *  migration (the exact form the design spec pins on non-empty lines). */
const HEADER_TUPLE_PATTERN =
  /^\s*-?\s*\*\*(Version|Status|Author|Spec:|Parent program|Depends on|Base|Constraints)\*\*:/;

/** The twelve §2.3/§3.3 front-matter key literals — the registry home set's
 *  vocabulary (the pin asserts registry anchors against it, so a stray bullet
 *  anchor entering the frontmatter home fails). */
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

/** Enumerate the in-registry corpus docs (both dirs, .md only, sorted). */
// biome-ignore lint/complexity/noStaticOnlyClass: the zero-bare-function discipline admits no standalone helper functions.
class CorpusInventory {
  static docs(): string[] {
    const docs: string[] = [];
    for (const dir of CORPUS_DIRS) {
      for (const name of readdirSync(`${REPO_ROOT}/${dir}`)) {
        if (name.endsWith(".md")) docs.push(`${dir}/${name}`);
      }
    }
    return docs.sort();
  }
}

describe("corpus form pin (T10 · §5.1/§6)", () => {
  it("holds the in-registry corpus set with front-matter first lines and registry-bounded key sets", () => {
    const docs = CorpusInventory.docs();
    expect(docs.filter((doc) => doc.startsWith("docs/kairos/specs"))).toHaveLength(12);
    expect(docs.filter((doc) => doc.startsWith("docs/kairos/plans"))).toHaveLength(11);
    expect(docs).toHaveLength(23);

    for (const rel of docs) {
      const content = readFileSync(`${REPO_ROOT}/${rel}`, "utf8");
      // First non-empty line is the opening fence.
      const first = content.split("\n").find((line) => line.trim() !== "");
      expect(first).toBe("---");

      // The front-matter block parses; the head carries a registered doc-type.
      const { head } = FrontMatterExtractor.split(content);
      const docType = head.docType;
      expect(docType).not.toBeNull();
      const registry =
        declaredRegistries[docType as "overall-spec" | "plan" | "phase-spec" | "single-spec"];

      // yaml.parse of the block: every key is a registry frontmatter-home anchor
      // and every required frontmatter-home anchor is present.
      const fence = content.indexOf("\n---");
      const yamlText = content.slice(content.indexOf("\n") + 1, fence);
      const record = parse(yamlText) as Record<string, unknown>;
      const keys = Object.keys(record);
      const frontmatterAnchors = registry.elements
        .filter((element) => element.home === "frontmatter")
        .map((element) => element.anchor);
      const requiredAnchors = registry.elements
        .filter((element) => element.home === "frontmatter" && element.presence === "required")
        .map((element) => element.anchor);

      expect(keys.every((key) => FRONTMATTER_KEYS.has(key))).toBe(true);
      expect(keys.every((key) => frontmatterAnchors.includes(key))).toBe(true);
      for (const anchor of requiredAnchors) expect(keys).toContain(anchor);
    }
  });

  it("zero-hits the retired header tuples across the corpus (§6 form pin)", () => {
    for (const rel of CorpusInventory.docs()) {
      const content = readFileSync(`${REPO_ROOT}/${rel}`, "utf8");
      expect(content.split("\n").some((line) => HEADER_TUPLE_PATTERN.test(line))).toBe(false);
    }
  });

  it("judges the migrated corpus to zero findings (baseline 0 → post-migration 0, same-set)", () => {
    const contract = new Contract();
    for (const rel of CorpusInventory.docs()) {
      const content = readFileSync(`${REPO_ROOT}/${rel}`, "utf8");
      const { head } = FrontMatterExtractor.split(content);
      const docKey = head.docType;
      expect(docKey).not.toBeNull();
      const findings = contract.validate({
        docKey: docKey as "overall-spec" | "plan" | "phase-spec" | "single-spec",
        // Absolute doc path: the file-existence/sibling-scan chains resolve
        // file-relative targets through `path.resolve(docPath)`, which is
        // cwd-dependent for a relative path — an absolute path keeps the
        // judgment basis the repo root regardless of the test runner's cwd.
        path: `${REPO_ROOT}/${rel}`,
        content,
        root: REPO_ROOT,
      });
      expect(findings).toEqual([]);
    }
  });

  it("maps an old-form Issues（收口时关闭） row to the issues: key (§2.3 rule)", () => {
    // The historical single-spec row (§5.1):
    //   `- **Issues（收口时关闭）**: #302（…）· #304（…）`
    // The migration rule (§5.1 emission): the old-form anchor row rewrites to
    // the `issues:` front-matter key, value byte-preserved. The migrated corpus
    // carries zero issues rows, so the rule is pinned on a constructed head —
    // the same §5.1 transformation the deleted migration script applied.
    const migrated = ReferenceMigration.migrateOldHead(
      [
        "# Cdd Review Contract Fix — Single Spec",
        "- **Version**: v1.0 · 2026-09-28",
        "- **Doc type**: single-spec",
        "- **Status**: Approved",
        "- **Author**: human",
        "- **Depends on**: cdd-review",
        "- **Issues（收口时关闭）**: #302（closed）· #304（closed）",
      ].join("\n"),
    );

    const { head } = FrontMatterExtractor.split(migrated);
    expect(head.issues).toBe("#302（closed）· #304（closed）");

    // The full front-matter round-trips through yaml.stringify/parse (§5.1's
    // emission channel) with the issues scalar intact.
    const fence = migrated.indexOf("---", 3);
    const record = parse(migrated.slice(4, fence)) as { issues?: string } | null;
    expect(record?.issues).toBe("#302（closed）· #304（closed）");
  });
});

/** The §5.1 emission rule for one old-form head, re-encoded for the Issues
 *  branch pin: reads the `- **Key**: value` rows and emits a §2.1 front-matter
 *  block via `yaml.stringify` (the migration's zero-concat emission channel).
 *  Only the rows live in the migrated corpus (title/doc-type/version/date/
 *  status/author/depends-on) plus the Issues row under test are mapped; the
 *  block must re-parse to a head whose accessors return the mapped values. */
// biome-ignore lint/complexity/noStaticOnlyClass: the zero-bare-function discipline admits no standalone helper functions.
class ReferenceMigration {
  static migrateOldHead(headText: string): string {
    const rows = new Map<string, string>();
    for (const line of headText.split("\n")) {
      const version = line.match(/^- \*\*Version\*\*: (v\d+\.\d+) · (\d{4}-\d{2}-\d{2})$/);
      if (version !== null) {
        rows.set("version", version[1]);
        rows.set("date", version[2]);
        continue;
      }
      const tuple = line.match(/^- \*\*Doc type\*\*: (\S+)$/);
      if (tuple !== null) {
        rows.set("doc-type", tuple[1]);
        continue;
      }
      const headRow = line.match(/^- \*\*(Status|Author|Depends on)\*\*: (.+)$/);
      if (headRow !== null) {
        rows.set(
          { Status: "status", Author: "author", "Depends on": "depends-on" }[headRow[1]]!,
          headRow[2],
        );
        continue;
      }
      const issues = line.match(/^- \*\*Issues（收口时关闭）\*\*: (.+)$/);
      if (issues !== null) {
        rows.set("issues", issues[1]);
        continue;
      }
      const title = line.match(/^# (.+)$/);
      if (title !== null) rows.set("title", title[1]);
    }

    const record: Record<string, string> = {};
    for (const key of [
      "title",
      "doc-type",
      "version",
      "date",
      "status",
      "author",
      "depends-on",
      "issues",
    ]) {
      const value = rows.get(key);
      if (value !== undefined) record[key] = value;
    }
    return `---\n${stringify(record).trimEnd()}\n---\n`;
  }
}
