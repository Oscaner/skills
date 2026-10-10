// packages/cdd-engine/src-next/contract/__tests__/translate.test.ts
// T19 Translator suite — the P7 bidirectional translation layer (design spec §1.2
// locale face):
//   · canonicalize — the recognition face: every registered Chinese alias span maps
//     to its canonical English form (a full-line alias is the single-token case), an
//     already-canonical / unregistered line passes through unchanged (identity) — the
//     positive + identity + negative cases, the P7 charter rows, and the
//     compound-word boundary;
//   · localize — the rendering face: the canonical token renders at the requested
//     locale (en = identity · zh = the row's alias), an unknown token / locale / a
//     row without the locale's alias is null;
//   · the bidirectional property — canonicalize(localize(token, zh)) recovers the
//     canonical token, over every row of the word table;
//   · the machine-face immunity — the capsule machine words (status · next: ·
//     CDD_BLOCKED:) are NOT locale rows: canonicalize passes them through unchanged
//     and localize cannot render them (the machine surface is English-constant,
//     never localized).
// The data all rides the word table (Words — the single source); the translator
// itself holds zero literal word data.

import { describe, expect, it } from "vitest";
import { Words } from "../../face/words.ts";
import { Translator } from "../translate.ts";

const words = new Words();
const translator = new Translator(words);

describe("Translator — the bidirectional translation layer", () => {
  it("canonicalize — a Chinese alias span maps to the canonical English token (the recognition face)", () => {
    expect(translator.canonicalize("## 场景")).toBe("## Context");
    expect(translator.canonicalize("## 问题")).toBe("## Problem");
    expect(translator.canonicalize("## 差距")).toBe("## Gap");
    expect(translator.canonicalize("## 建议方向")).toBe("## Suggested direction");
    expect(translator.canonicalize("## 建议修复")).toBe("## Suggested fix");
  });

  it("canonicalize — the charter rows: a registered Chinese marker maps to its canonical form", () => {
    expect(translator.canonicalize("M 组")).toBe("M group");
    expect(translator.canonicalize("#### 上游先例背书")).toBe("#### Upstream Endorsements");
    expect(translator.canonicalize("### cdd-engine 服务化主线")).toBe(
      "### cdd-engine service mainline",
    );
  });

  it("canonicalize — an already-canonical line passes through (identity)", () => {
    expect(translator.canonicalize("## Context")).toBe("## Context");
    expect(translator.canonicalize("## Suggested fix")).toBe("## Suggested fix");
  });

  it("canonicalize — unregistered text passes through unchanged (no null face)", () => {
    expect(translator.canonicalize("## 未知")).toBe("## 未知");
    expect(translator.canonicalize("bogus")).toBe("bogus");
    expect(translator.canonicalize("")).toBe("");
  });

  it("canonicalize — the compound boundary: only the registered span is replaced, neighbors untouched", () => {
    // 件 is unregistered — the single-character 组 alias replaces only its own span
    expect(translator.canonicalize("组件")).toBe("group件");
    // trailing unregistered prose (the date parenthetical) passes through verbatim
    expect(translator.canonicalize("cdd-engine 服务化主线（2026-09-13 用户升维）")).toBe(
      "cdd-engine service mainline（2026-09-13 用户升维）",
    );
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

  it("the round trip — canonicalize(localize(token, zh)) recovers the canonical token over every row", () => {
    for (const row of words.localeRows()) {
      const localized = translator.localize(row.en, "zh");
      expect(localized).not.toBeNull();
      expect(translator.canonicalize(localized!)).toBe(row.en);
    }
  });

  it("the machine face is not the translation surface — the capsule words carry zero aliases", () => {
    // status / next: / CDD_BLOCKED: / the status vocabulary are the capsule machine
    // channel words — English-constant, never human-readable rendering words. The
    // Translator over the word table holds no alias for them — canonicalize passes
    // them through unchanged, localize cannot render them.
    expect(translator.canonicalize(words.station("next"))).toBe("next:");
    expect(translator.canonicalize(words.station("blocked"))).toBe("CDD_BLOCKED:");
    expect(translator.canonicalize(words.station("warn"))).toBe("CDD_WARN:");
    expect(translator.localize(words.station("next"), "zh")).toBeNull();
    expect(translator.localize("status", "zh")).toBeNull();
    expect(translator.localize(words.statusVocab()[0], "zh")).toBeNull();
    expect(translator.localize(words.statusVocab()[1], "zh")).toBeNull();
  });
});
