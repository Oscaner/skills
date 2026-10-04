// packages/cdd-engine/src/documents/words.ts — the words domain content + renderer (P1 T4; plan
// §T4 · design C1/Q5). The words domain of the doc types carries the ENGINE LEXICON CONTENT (the
// `_doc` / command.{status,capsule,route} / schema.anatomy wings that config/contract-lexicon.json
// documents) as ONE shared DocWords object — the words single-source every doc type references
// (never copied), and the WordTable consumer path in infra reads the same facts from the DERIVED
// product file, byte-consumed, unchanged.
//
// This module homes the shared content const (DOC_WORDS — the object the three doc types pass as
// their words domain) and the WordsWriter: a byte-faithful deterministic projection of the words
// content onto the config/contract-lexicon.json product — `JSON.stringify(words, null, 2) + "\n"`
// (key order + 2-space indent + trailing newline, the same canonical projection the SchemaFactory
// registered for the schema products at T3). The first live writeAll normalized the hand-condensed
// pre-derivation file to the canonical form in place — parse-identical, whitespace-only — and that
// normalization is the registered derived baseline, not a drift signal; the colocated words.test.ts
// byte-pins the product against it, so a manual file edit or a content change not landed by
// writeAll breaks the pin (the design-drift signal). Content edits go through DocWords, never the
// derived file. The anti-circular red line holds: documents/ never imports infra/word-table.ts —
// the words content self-carries, and infra consumes the product file. Export face: the content
// const + the class + the module singleton (Criterion ② — class + constructor injection, no bare
// functions).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveResourceSrc } from "../infra/resource.ts";
import type { DocWords } from "./doctype.ts";

/** The engine lexicon content — the single shared DocWords object every doc type references as its
 *  words domain (words single-source, never copied) and the WordsWriter projects onto the derived
 *  config/contract-lexicon.json product byte-equivalently. The authored key order IS the product's
 *  key order: edit content here, never the derived file. */
export const DOC_WORDS: DocWords = {
  _doc: "CDD engine contract word table — the vocabulary of the engine command contract: the status values and their dual-axis mapping (command.status), the stdout capsule keys and the review read-back wording (command.capsule), and the stdout route anchors with the stderr station channels (command.route). The reference facts the engine services read (the skill-anatomy schema path / skills root) live under schema. Ownership: the command and schema families are engine-contract facts and ship with the package (dist/config/contract-lexicon.json rides the build mirror, same pipeline and cadence as the harness contract); the repository-verification vocabulary (the residue ban table, the escape directive ban, the zero-debt source-plane ban, the buildability dual-evidence wording, the banned shape names) lives in the guard lexicon (scripts/lib/guard-lexicon.json) and is not shipped here. Machine-token leaves are arrays (vocab / tokens); wording leaves are plain strings (readbackWording); the route stations are an addressed map the engine looks up by its station key.",
  command: {
    status: {
      vocab: ["APPROVED", "BLOCKED", "CHANGES_REQUESTED", "REVIEW_FIX", "TIMEOUT"],
      axes: {
        judgment: ["CHANGES_REQUESTED", "REVIEW_FIX", "APPROVED"],
        work: ["COMPLETED"],
      },
    },
    capsule: {
      tokens: ["status", "blocker", "handoff"],
      readbackWording: "(read <handoff> back to confirm)",
    },
    route: {
      routeTokens: ["next:", "findings"],
      stations: {
        next: "next:",
        blocked: "CDD_BLOCKED:",
        warn: "CDD_WARN:",
        cliMissing: "CDD_CLI_MISSING:",
      },
    },
  },
  schema: {
    anatomy: {
      schemaPath: "packages/cdd-engine/config/schema/skill-anatomy.json",
      skillsRoot: "packages/kairos/skills",
    },
  },
};

/** The words-domain renderer — projects the shared DocWords content onto the derived
 *  config/contract-lexicon.json product byte-faithfully: key order follows the authored content,
 *  indentation is the fixed 2-space form, the file ends on exactly one newline (the canonical
 *  derived-baseline projection registered for T3..T7). */
export class WordsWriter {
  readonly #words: DocWords;

  /** The content the renderer projects — constructor injection (Criterion ②); the shared DOC_WORDS
   *  object is the production input, a test may inject a fabricated content object. */
  constructor(words: DocWords) {
    this.#words = words;
  }

  /** One product's bytes — the canonical projection of the words content (`JSON.stringify` + the
   *  trailing newline). The projected bytes ARE the on-disk baseline (the derived baseline the
   *  words.test byte pin asserts against). */
  render(): string {
    return `${JSON.stringify(this.#words, null, 2)}\n`;
  }

  /** Land the rendered bytes onto the contract-lexicon product in place (zero path migration — the
   *  default target is the source-home config/contract-lexicon.json face, the canonical derivation
   *  location the guards read; tests inject a temp path). Returns the written path. */
  writeAll(lexiconPath = resolveResourceSrc("contract-lexicon")): string {
    mkdirSync(path.dirname(lexiconPath), { recursive: true });
    writeFileSync(lexiconPath, this.render());
    return lexiconPath;
  }
}

/** The engine-wide words-writer singleton (the same holder pattern as schemaFactory — composition
 *  over the shared DOC_WORDS content; the default write target is the source-home
 *  config/contract-lexicon.json face, the canonical derivation location). */
export const wordsWriter = new WordsWriter(DOC_WORDS);
