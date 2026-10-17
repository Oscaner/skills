// packages/cdd-engine/src-next/contract/__tests__/frontmatter.test.ts
// T1 test suite for the front-matter head extraction chain (contract/frontmatter.ts):
//   · the `---` fence split — the head/body boundary, the no-fence fallback;
//   · the non-scalar downgrade — a list value reads null through the accessor;
//   · the RAW channel — the extracted value equals the source string verbatim;
//   · the twelve declared getters map the §2.3 key set.

import { describe, expect, it } from "vitest";
import { FrontMatterExtractor, FrontMatterHead } from "../frontmatter.ts";

/** The full §2.1 plan-shaped front matter — every one of the twelve declared keys. */
const FULL_HEAD = [
  "---",
  "title: 引擎文档工具（Engine Doc-Tooling）— 测试 Plan",
  "doc-type: plan",
  "version: v0.9",
  "date: 2026-10-17",
  "spec: docs/kairos/specs/2026-10-10-engine-doc-tooling-p10-design.md",
  "parent-program: docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md",
  "parent-version: v2.46",
  "depends-on: P9",
  "base: develop",
  "status: Draft",
  'author: "[human] · Claude Opus 5（…）"',
  "issues: close all issues",
  "---",
  "## Design",
  "body prose",
].join("\n");

describe("FrontMatterExtractor.split — the fence split", () => {
  it("splits a fenced head from the body at the second `---` fence", () => {
    const { head, body } = FrontMatterExtractor.split(FULL_HEAD);
    expect(body).toBe("## Design\nbody prose");
    expect(head.title).toBe("引擎文档工具（Engine Doc-Tooling）— 测试 Plan");
    expect(head.docType).toBe("plan");
  });

  it("returns a null head and the original content when no opening fence is on line zero", () => {
    const content = "no fence here\nbody line";
    const { head, body } = FrontMatterExtractor.split(content);
    expect(body).toBe(content);
    expect(head.title).toBeNull();
    for (const key of [
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
    ])
      expect(head.value(key)).toBeNull();
  });

  it("returns a null head and the original content when the closing fence is missing", () => {
    const content = "---\ntitle: dangling\nbody line";
    const { head, body } = FrontMatterExtractor.split(content);
    expect(body).toBe(content);
    expect(head.value("title")).toBeNull();
  });

  it("returns a null head and the original content when the fenced block is not a YAML record", () => {
    const content = "---\n- a\n- b\n---\nbody line";
    const { head, body } = FrontMatterExtractor.split(content);
    expect(body).toBe(content);
    expect(head.value("title")).toBeNull();
  });

  it("returns a null head and the original content when the fenced YAML fails to parse", () => {
    const content = "---\n: bad : yaml\n---\nbody line";
    const { head, body } = FrontMatterExtractor.split(content);
    expect(body).toBe(content);
    expect(head.value("title")).toBeNull();
  });
});

describe("FrontMatterHead.value — the typed accessor", () => {
  const { head } = FrontMatterExtractor.split(FULL_HEAD);

  it("reads every declared scalar key through value(key)", () => {
    expect(head.value("title")).toBe("引擎文档工具（Engine Doc-Tooling）— 测试 Plan");
    expect(head.value("version")).toBe("v0.9");
    expect(head.value("depends-on")).toBe("P9");
    expect(head.value("base")).toBe("develop");
    expect(head.value("issues")).toBe("close all issues");
  });

  it("downgrades a non-scalar YAML value to null (a list is not a head fact)", () => {
    const { head: listHead } = FrontMatterExtractor.split(
      "---\ntitle: test\nissues:\n  - a\n  - b\n---\nbody",
    );
    expect(listHead.value("issues")).toBeNull();
    expect(listHead.value("title")).toBe("test");
  });

  it("downgrades a non-string scalar (a bare number) to null", () => {
    const { head: numberHead } = FrontMatterExtractor.split("---\nversion: 2.46\n---\nbody");
    expect(numberHead.value("version")).toBeNull();
  });
});

describe("the RAW channel — extraction matches the source verbatim", () => {
  it("reads a bracket-led author value byte-for-byte from the source string", () => {
    const { head } = FrontMatterExtractor.split(FULL_HEAD);
    expect(head.author).toBe("[human] · Claude Opus 5（…）");
    expect(head.value("author")).toBe(head.author);
  });
});

describe("the twelve declared getters (§2.3 key set)", () => {
  const { head } = FrontMatterExtractor.split(FULL_HEAD);

  it("exposes the kebab keys through the getter surface", () => {
    expect(head.title).toBe("引擎文档工具（Engine Doc-Tooling）— 测试 Plan");
    expect(head.docType).toBe("plan");
    expect(head.version).toBe("v0.9");
    expect(head.date).toBe("2026-10-17");
    expect(head.status).toBe("Draft");
    expect(head.author).toBe("[human] · Claude Opus 5（…）");
    expect(head.spec).toBe("docs/kairos/specs/2026-10-10-engine-doc-tooling-p10-design.md");
    expect(head.parentProgram).toBe("docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md");
    expect(head.parentVersion).toBe("v2.46");
    expect(head.dependsOn).toBe("P9");
    expect(head.base).toBe("develop");
    expect(head.issues).toBe("close all issues");
  });

  it("reads null for every getter on an empty head", () => {
    const empty = new FrontMatterHead(null);
    expect(empty.title).toBeNull();
    expect(empty.docType).toBeNull();
    expect(empty.version).toBeNull();
    expect(empty.date).toBeNull();
    expect(empty.status).toBeNull();
    expect(empty.author).toBeNull();
    expect(empty.spec).toBeNull();
    expect(empty.parentProgram).toBeNull();
    expect(empty.parentVersion).toBeNull();
    expect(empty.dependsOn).toBeNull();
    expect(empty.base).toBeNull();
    expect(empty.issues).toBeNull();
  });
});
