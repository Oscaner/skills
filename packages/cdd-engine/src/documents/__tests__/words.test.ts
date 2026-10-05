// packages/cdd-engine/src/documents/__tests__/words.test.ts — the words domain suite (P1 T4; plan
// §T4 · design C1/Q5). Coverage:
//   - the byte pin: the WordsWriter render is byte-equal (`Buffer.equals`) to the on-disk
//     config/contract-lexicon.json golden, read in full. The golden is the CURRENT DERIVED STATE —
//     the canonical `JSON.stringify(words, null, 2) + "\n"` projection, the registered product
//     baseline (the T3..T7 derived-baseline decision; the first live writeAll normalized the
//     pre-derivation file's hand-condensed nodes to that form in place — parse-identical,
//     whitespace-only). A pin break means words↔product divergence (a manual file edit, or a
//     content change not landed by writeAll) — the design-drift signal;
//   - determinism: the same content renders byte-identical twice (the projection has no hidden
//     state — key order + fixed formatting only);
//   - the write surface (writeAll into an injected temp path) reproduces the on-disk product bytes
//     exactly, and a test-injected content object renders deterministically;
//   - the same-source reference (words single-source — Q5): under the registry.all() FIXED
//     iteration order [overall, plan, spec], every registered doc type's words domain IS the same
//     shared DOC_WORDS object (identity — never copied);
//   - the infra consumer path (infra↔documents zero reverse dependency): the RENDERED product loads
//     through the WordTable constructor's Ajv self-validation (the shape authority's
//     additionalProperties: false) with its accessors serving the same facts — infra consumes the
//     derived file's bytes, never the documents plane.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveResourceSrc } from "../../infra/resource.ts";
import { WordTable } from "../../infra/word-table.ts";
import { docTypeRegistry } from "../registry.ts";
import { DOC_WORDS, WordsWriter, wordsWriter } from "../words.ts";

/** The pinned source home — the derived product the writer projects (the same locator face the
 *  WordTable constructor resolves; never a second literal path). */
const LEXICON = resolveResourceSrc("contract-lexicon");
/** The shape-authority schema the WordTable construction validates the rendered product against. */
const SCHEMA = path.join(resolveResourceSrc("schema"), "contract-lexicon.json");

describe("WordsWriter (P1 T4)", () => {
  it("byte pin: the rendered product is byte-equal to the on-disk contract-lexicon product (the derived baseline)", () => {
    const golden = readFileSync(LEXICON);
    expect(Buffer.from(wordsWriter.render()).equals(golden)).toBe(true);
  });

  it("determinism: the same content renders byte-identical twice", () => {
    const first = wordsWriter.render();
    const second = wordsWriter.render();
    expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);
  });

  it("the write surface (injected temp path) reproduces the on-disk product bytes exactly", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-words-writer-"));
    try {
      const target = path.join(dir, "contract-lexicon.json");
      const written = wordsWriter.writeAll(target);
      expect(written).toBe(target);
      expect(readFileSync(target).equals(readFileSync(LEXICON))).toBe(true);
      expect(readFileSync(target, "utf8")).toBe(wordsWriter.render());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("constructor injection: a fresh instance over the shared DOC_WORDS renders byte-identically", () => {
    const writer = new WordsWriter(DOC_WORDS);
    expect(Buffer.from(writer.render()).equals(Buffer.from(wordsWriter.render()))).toBe(true);
  });

  it("same-source reference: under the registry.all() fixed order, every doc type's words IS the shared DOC_WORDS object", () => {
    const types = docTypeRegistry.all();
    expect(types.map((type) => type.kind)).toEqual(["overall", "plan", "spec"]);
    for (const type of types) {
      expect(type.words).toBe(DOC_WORDS);
    }
  });

  it("infra consumer path: the rendered product passes the WordTable Ajv construction with accessors serving the same facts", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-words-consumer-"));
    try {
      const target = path.join(dir, "contract-lexicon.json");
      wordsWriter.writeAll(target);
      const wt = new WordTable({ lexiconPath: target, schemaPath: SCHEMA });
      expect(wt.vocab("status")).toEqual(DOC_WORDS.command.status.vocab);
      expect(wt.vocab("statusJudgment")).toEqual(DOC_WORDS.command.status.axes.judgment);
      expect(wt.vocab("statusWork")).toEqual(DOC_WORDS.command.status.axes.work);
      expect(wt.tokens("capsule")).toEqual(DOC_WORDS.command.capsule.tokens);
      expect(wt.capsuleToken("status")).toBe(DOC_WORDS.command.capsule.tokens[0]);
      expect(wt.wording("readback")).toBe(DOC_WORDS.command.capsule.readbackWording);
      expect(wt.tokens("route")).toEqual(DOC_WORDS.command.route.routeTokens);
      expect(wt.station("next")).toBe(DOC_WORDS.command.route.stations.next);
      expect(wt.station("blocked")).toBe(DOC_WORDS.command.route.stations.blocked);
      expect(wt.station("warn")).toBe(DOC_WORDS.command.route.stations.warn);
      expect(wt.station("cliMissing")).toBe(DOC_WORDS.command.route.stations.cliMissing);
      expect(wt.ref("schema.anatomy.schemaPath")).toBe(DOC_WORDS.schema.anatomy.schemaPath);
      expect(wt.ref("schema.anatomy.skillsRoot")).toBe(DOC_WORDS.schema.anatomy.skillsRoot);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
