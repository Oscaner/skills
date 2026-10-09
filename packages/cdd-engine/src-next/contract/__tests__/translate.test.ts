// packages/cdd-engine/src-next/contract/__tests__/translate.test.ts
// T19 Translator suite — the P7 bidirectional translation layer (design spec §1.2
// locale face):
//   · normalize — the recognition face: a Chinese alias maps to the canonical English
//     token, an already-canonical word passes through (identity), an unknown word is
//     null (the positive + negative cases);
//   · localize — the rendering face: the canonical token renders at the requested
//     locale (en = identity · zh = the row's alias), an unknown token / locale / a
//     row without the locale's alias is null;
//   · the bidirectional property — normalize(localize(token, zh)) recovers the
//     canonical token, over every row of the word table;
//   · the machine-face immunity — the capsule machine words (status · next: ·
//     CDD_BLOCKED:) are NOT locale rows: the Translator cannot recognize or localize
//     them (the machine surface is English-constant, never localized).
// The data all rides the word table (Words — the single source); the translator
// itself holds zero literal word data.

import { describe, expect, it } from "vitest";
import { Words } from "../../face/words.ts";
import { Translator } from "../translate.ts";

const words = new Words();
const translator = new Translator(words);

describe("Translator — the bidirectional translation layer", () => {
  it("normalize — a Chinese alias maps to the canonical English token (the recognition face)", () => {
    expect(translator.normalize("## 场景")).toBe("## Context");
    expect(translator.normalize("## 问题")).toBe("## Problem");
    expect(translator.normalize("## 差距")).toBe("## Gap");
    expect(translator.normalize("## 建议方向")).toBe("## Suggested direction");
    expect(translator.normalize("## 建议修复")).toBe("## Suggested fix");
  });

  it("normalize — an already-canonical word passes through (identity)", () => {
    expect(translator.normalize("## Context")).toBe("## Context");
    expect(translator.normalize("## Suggested fix")).toBe("## Suggested fix");
  });

  it("normalize — an unknown word is null (the negative face)", () => {
    expect(translator.normalize("## 未知")).toBeNull();
    expect(translator.normalize("bogus")).toBeNull();
    expect(translator.normalize("")).toBeNull();
  });

  it("localize — the canonical token renders at the requested locale (en identity · zh alias)", () => {
    expect(translator.localize("## Context", "en")).toBe("## Context");
    expect(translator.localize("## Problem", "zh")).toBe("## 问题");
    expect(translator.localize("## Impact", "zh")).toBe("## 影响");
    expect(translator.localize("## Suggested direction", "zh")).toBe("## 建议方向");
  });

  it("localize — an unknown token / locale is null (the negative face)", () => {
    expect(translator.localize("bogus", "zh")).toBeNull();
    expect(translator.localize("## Context", "fr")).toBeNull();
    expect(translator.localize("", "zh")).toBeNull();
  });

  it("the round trip — normalize(localize(token, zh)) recovers the canonical token over every row", () => {
    for (const row of words.localeRows()) {
      const localized = translator.localize(row.en, "zh");
      expect(localized).not.toBeNull();
      expect(translator.normalize(localized!)).toBe(row.en);
    }
  });

  it("the machine face is not the translation surface — the capsule words carry zero aliases", () => {
    // status / next: / CDD_BLOCKED: / the status vocabulary are the capsule machine
    // channel words — English-constant, never human-readable rendering words. The
    // Translator over the word table cannot recognize or localize them.
    expect(translator.normalize(words.station("next"))).toBeNull();
    expect(translator.normalize(words.station("blocked"))).toBeNull();
    expect(translator.normalize(words.station("warn"))).toBeNull();
    expect(translator.localize(words.station("next"), "zh")).toBeNull();
    expect(translator.localize("status", "zh")).toBeNull();
    expect(translator.localize(words.statusVocab()[0], "zh")).toBeNull();
    expect(translator.localize(words.statusVocab()[1], "zh")).toBeNull();
  });
});
