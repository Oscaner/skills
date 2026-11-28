// packages/cdd-engine/src/docs/skeleton/__tests__/skeleton.test.ts
// The skeleton's pins.
//
// Five groups: the four families (one case each, and the type set is the same constant the
// switch branches on) · the landing (the bytes are `skeletonOf` plus exactly one newline, the
// writer is called once, and its failure is a value, never a throw) · the missing target (a
// declared refusal BEFORE any write) · the injected date (the same day twice is the same
// bytes; no day is a throw, never the system clock) · and the slice's filesystem boundary.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RepoPath } from "../../../env/paths/root.ts";
import { Projector } from "../../identity/project.ts";
import { declaredRegistries } from "../../identity/registry.ts";
import { DOC_TYPE_VALUES, type DocType } from "../../identity/types.ts";
import { Documents, type DocumentsOptions } from "../../index.ts";
import { SkeletonAssembler } from "../assembler.ts";

/** The docs slice's root — the filesystem-boundary scan's basis. */
const DOCS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** The corpus's frozen day — one date for every case that renders. */
const FROZEN_DAY = "2026-11-25";

/** A reader that never has a file to read — the skeleton faces read nothing. */
const noReader = (target: RepoPath) => ({ kind: "read-failure" as const, target });

/** One `Documents` over a counting writer, plus the log it fills. */
const documentsWith = (opts: Partial<DocumentsOptions> = {}) => {
  const writes: { target: RepoPath; text: string }[] = [];
  const documents = new Documents({
    readText: noReader,
    today: FROZEN_DAY,
    textWriter: (target, text) => {
      writes.push({ target, text });
      return { kind: "written", target };
    },
    ...opts,
  });
  return { documents, writes };
};

describe("the four families", () => {
  it("composes every declared document type — the type set IS the switch's branch set", () => {
    const projection = new Projector(declaredRegistries).skeleton();
    const assembler = new SkeletonAssembler({
      projection,
      today: FROZEN_DAY,
      textWriter: (target) => ({ kind: "written", target }),
    });
    // Both sides derive from the vocabulary's tuple: no literal list of families here.
    expect(SkeletonAssembler.types()).toEqual([...DOC_TYPE_VALUES]);
    for (const type of DOC_TYPE_VALUES) {
      const bytes = assembler.compose(type);
      expect(bytes.length).toBeGreaterThan(0);
      // The head's `doc-type:` truth is the type itself — the branch that answered was the
      // right one, not a fallback.
      expect(bytes).toContain(`doc-type: ${type}`);
      // No trailing newline: the writer adds the one.
      expect(bytes.endsWith("\n")).toBe(false);
      expect(bytes.endsWith("\n\n")).toBe(false);
    }
  });

  it("keeps the front-matter day and the history row on the injected day", () => {
    const { documents } = documentsWith();
    for (const type of DOC_TYPE_VALUES) {
      const bytes = documents.skeletonOf(type);
      expect(bytes).toContain(`date: ${FROZEN_DAY}`);
      expect(bytes).toContain(`| v0.1 | ${FROZEN_DAY} | :::fill summary | :::fill author |`);
    }
  });
});

describe("the landing", () => {
  it("writes `skeletonOf` plus exactly one newline, once, at the target it echoes", () => {
    const { documents, writes } = documentsWith();
    for (const type of DOC_TYPE_VALUES) {
      writes.length = 0;
      const target = `docs/kairos/skeletons/${type}.md` as RepoPath;
      const landed = documents.skeletonAt(type, target);
      expect(landed).toEqual({ kind: "written", target });
      expect(writes).toHaveLength(1);
      expect(writes[0]?.target).toBe(target);
      // Byte equality, not a line count: the document ends with exactly one newline.
      expect(writes[0]?.text).toBe(`${documents.skeletonOf(type)}\n`);
      expect((writes[0]?.text ?? "").endsWith("\n\n")).toBe(false);
    }
  });

  it("answers the writer's failure instead of throwing", () => {
    const { documents } = documentsWith({
      textWriter: (target) => ({ kind: "write-failure", target }),
    });
    const target = "docs/kairos/skeletons/plan.md" as RepoPath;
    expect(documents.skeletonAt("plan", target)).toEqual({ kind: "write-failure", target });
  });

  it("refuses a missing target BEFORE any write", () => {
    const { documents, writes } = documentsWith();
    // The refusal names a KIND of refusal only — `docs/` knows no command vocabulary.
    expect(documents.skeletonAt("overall", undefined)).toEqual({ kind: "missing-target" });
    expect(writes).toEqual([]);
  });
});

describe("the injected day", () => {
  it("renders the same bytes twice under one frozen day, and different bytes under another", () => {
    const first = documentsWith().documents.skeletonOf("plan");
    const second = documentsWith().documents.skeletonOf("plan");
    expect(second).toBe(first);
    const other = documentsWith({ today: "2001-02-03" }).documents.skeletonOf("plan");
    expect(other).not.toBe(first);
    expect(other).toContain("date: 2001-02-03");
  });

  it("throws at construction when no day is injected — it never reads a clock", () => {
    const projection = new Projector(declaredRegistries).skeleton();
    expect(
      () =>
        new SkeletonAssembler({
          projection,
          today: "" as string,
          textWriter: (target) => ({ kind: "written", target }),
        }),
    ).toThrow(/today.*required/);
  });
});

describe("the slice's boundary", () => {
  it("imports no `node:fs` anywhere under `docs/skeleton/` or in `docs/index.ts`", () => {
    // `env/` stays the only slice that imports `node:fs`: every read and every write here is
    // an injected face.
    const files = [
      "index.ts",
      ...["assembler.ts"].map((name) => `skeleton/${name}`),
      ...[
        "judging/criteria.ts",
        "judging/completion.ts",
        "judging/wave-width.ts",
        "judging/task-graph.ts",
      ],
    ];
    expect(files.length).toBeGreaterThan(4);
    for (const file of files) {
      expect(readFileSync(path.join(DOCS_ROOT, file), "utf8")).not.toContain('"node:fs"');
    }
  });

  it("composes each family without a filesystem — the assembler holds the writer, not fs", () => {
    const type: DocType = "single-spec";
    const { documents } = documentsWith();
    expect(documents.skeletonOf(type).length).toBeGreaterThan(0);
  });
});
