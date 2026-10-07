// packages/cdd-engine/src-next/face/__tests__/face.test.ts
// T10 Words + Capsule suite (design spec §1.2 / §3.2):
//   · the word table — the three families served by one instance (doc words
//     derived from the T2 registries, the capsule station words, the guard ban
//     words), with zero second tables — the capsule's every emitted word is
//     looked up on the same Words instance;
//   · the byte pin — Capsule#emit renders the `status · blocker · handoff` line
//     and the optional `next:` line byte-stably (every route row rendered);
//   · the word-face comparison — the v1 emitted face is byte-identical to the
//     existing consumed word face (status · blocker · handoff · next:) — same
//     words, no re-judgment: a steady state, not a compatibility shim;
//   · the locale face (T19) — the word table's locale columns: the locale key set
//     (the langs projection source), the issue-label rows (one per finding type ×
//     segment), and the machine-face immunity — the capsule words carry zero locale
//     aliases (the machine surface is English-constant, never localized).
// The type assertion at the bottom pins the T8 run seam (CapsuleFace) — the
// interaction point the lifecycle attaches.

import { describe, expect, it } from "vitest";
import { Translator } from "../../contract/translate.ts";
import { FIX_READBACK_SUFFIX } from "../../session/next.ts";
import type { CapsuleFace } from "../../session/run.ts";
import { Capsule } from "../capsule.ts";
import { CAPSULE_WORDS, GUARD_BAN_WORDS, Words } from "../words.ts";

const words = new Words();
const capsule = new Capsule(words);

describe("the word table — one table, three families", () => {
  it("the doc family derives from the T2 registries — the DOC_TOKENS face", () => {
    // the registered plan anchors are doc words; the counts = the declared registry
    // element counts (39 / 24 / 21 — the complete-contract pin of declare.ts)
    expect(words.docWords("overall").length).toBe(39);
    expect(words.docWords("plan").length).toBe(24);
    expect(words.docWords("phaseSpec").length).toBe(21);
    expect(words.docWords("plan")).toContain("### Task N:");
    expect(words.docWords("plan")).toContain("**DependsOn**");
    expect(words.docWords("overall")).toContain("## Dependency graph");
    expect(words.docWords("phaseSpec")).toContain("## Design");
    expect(words.hasDocWord("plan", "**Acceptance**")).toBe(true);
    expect(words.hasDocWord("plan", "## Design")).toBe(false);
  });

  it("the capsule family — the pinned keys, the stations, the status vocabulary", () => {
    expect(words.capsuleKeys()).toEqual(["status", "blocker", "handoff"]);
    expect(words.capsuleSeparator()).toBe(" · ");
    expect(words.statusVocab()).toEqual([
      "APPROVED",
      "BLOCKED",
      "CHANGES_REQUESTED",
      "REVIEW_FIX",
      "TIMEOUT",
    ]);
    expect(words.station("next")).toBe("next:");
    expect(words.station("blocked")).toBe("CDD_BLOCKED:");
    expect(words.station("warn")).toBe("CDD_WARN:");
    expect(words.station("cliMissing")).toBe("CDD_CLI_MISSING:");
    expect(words.routeWord("none")).toBe("none");
    expect(words.routeWord("review")).toBe("review");
    expect(words.routeWord("fix")).toBe("fix");
  });

  it("the guard family — the STALE / GATE / shape ban rows, one flat scan set", () => {
    expect(words.guardBanWords("stale").length).toBeGreaterThan(0);
    expect(words.guardBanWords("gate").length).toBeGreaterThan(0);
    expect(words.guardBanWords("shape").length).toBeGreaterThan(0);
    expect(words.guardBanTokens()).toEqual(
      [...GUARD_BAN_WORDS.stale, ...GUARD_BAN_WORDS.gate, ...GUARD_BAN_WORDS.shape].map(
        (row) => row.token,
      ),
    );
    // the flat set carries no duplicate ban token — every family row is unique
    const tokens = words.guardBanTokens();
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("the capsule carries zero second table — every emitted word rides this instance", () => {
    const emitted = capsule.emit("APPROVED", "0", "/ws/tasks-1-implement.json", {
      kind: "review",
      base: "a".repeat(40),
    });
    // the emitted keys ARE the table's keys, in the table's order — no parallel list
    const keysOf = emitted[0]
      .split(words.capsuleSeparator())
      .map((cell) => cell.slice(0, cell.indexOf(": ")));
    expect(keysOf).toEqual([...words.capsuleKeys()]);
    // the only station word in the output is the table's own `next:`
    expect(emitted[1].split(" ")[0]).toBe(words.station("next"));
    expect(Object.values(CAPSULE_WORDS.stations).length).toBe(4);
  });
});

describe("the capsule byte pin — the single output face", () => {
  it("renders the capsule line byte-stably (status · blocker · handoff)", () => {
    expect(capsule.emit("APPROVED", "0", "/ws/tasks-1-implement.json")).toEqual([
      "status: APPROVED · blocker: 0 · handoff: /ws/tasks-1-implement.json",
    ]);
    expect(capsule.emit("BLOCKED", "1", "/ws/branch-review-a1b2c3d..e4f5g6h-r1.json")).toEqual([
      "status: BLOCKED · blocker: 1 · handoff: /ws/branch-review-a1b2c3d..e4f5g6h-r1.json",
    ]);
  });

  it("renders the `next:` line per the C5 route row (each kind, only present facts)", () => {
    const base = "a".repeat(40);
    expect(capsule.emit("APPROVED", "0", "/h.json", { kind: "none" })).toEqual([
      "status: APPROVED · blocker: 0 · handoff: /h.json",
      "next: none",
    ]);
    expect(capsule.emit("APPROVED", "0", "/h.json", { kind: "next-group", tasks: "7,9" })).toEqual([
      "status: APPROVED · blocker: 0 · handoff: /h.json",
      "next: 7,9",
    ]);
    expect(capsule.emit("REVIEW_FIX", "0", "/h.json", { kind: "review", base })).toEqual([
      "status: REVIEW_FIX · blocker: 0 · handoff: /h.json",
      "next: review aaaaaaa",
    ]);
    expect(
      capsule.emit("CHANGES_REQUESTED", "1", "/h.json", {
        kind: "fix",
        findings: "tasks-1-review-1.json",
      }),
    ).toEqual([
      "status: CHANGES_REQUESTED · blocker: 1 · handoff: /h.json",
      `next: tasks-1-review-1.json ${FIX_READBACK_SUFFIX}`,
    ]);
    // a fix route without its input renders the bare classifier
    expect(capsule.emit("CHANGES_REQUESTED", "1", "/h.json", { kind: "fix" })).toEqual([
      "status: CHANGES_REQUESTED · blocker: 1 · handoff: /h.json",
      "next: fix",
    ]);
    // the soft-cap message rides verbatim — the user-adjudication station
    expect(
      capsule.emit("BLOCKED", "0", "/h.json", {
        kind: "soft-cap",
        message: "BLOCKED: review-cycle-cap — user adjudicates",
      }),
    ).toEqual([
      "status: BLOCKED · blocker: 0 · handoff: /h.json",
      "next: BLOCKED: review-cycle-cap — user adjudicates",
    ]);
  });

  it("a caller-rendered next text rides verbatim; absent next emits no second line", () => {
    expect(capsule.emit("APPROVED", "0", "/h.json", "put /h.json back")).toEqual([
      "status: APPROVED · blocker: 0 · handoff: /h.json",
      "next: put /h.json back",
    ]);
    expect(capsule.emit("BLOCKED", "engine over budget", "/h.json")).toEqual([
      "status: BLOCKED · blocker: engine over budget · handoff: /h.json",
    ]);
    expect(capsule.emit("TIMEOUT", "0", "/h.json", null)).toEqual([
      "status: TIMEOUT · blocker: 0 · handoff: /h.json",
    ]);
  });

  it("the blocker cell carries a count or a reason text — the cell stays a plain string", () => {
    expect(capsule.emit("BLOCKED", "CDD_BLOCKED: resolve the finding", "/h.json")[0]).toBe(
      "status: BLOCKED · blocker: CDD_BLOCKED: resolve the finding · handoff: /h.json",
    );
  });
});

describe("the word-face comparison — v1 face vs the existing consumed face", () => {
  it("the v1 emitted word face is byte-identical to the existing consumed face (same words, no re-judgment)", () => {
    // The existing machine face consumers grep / route on — the steady vocabulary
    // (status · blocker · handoff · next:). v1 keeps the same four words: a rename
    // breaks this literal pin — a steady state, never a compatibility shim.
    expect(capsule.emit("APPROVED", "0", "/ws/tasks-1-implement.json")[0]).toBe(
      "status: APPROVED · blocker: 0 · handoff: /ws/tasks-1-implement.json",
    );
    // the four word cells of the face, in the emitted order — the existing consumed
    // order the comparison keys on
    expect([...words.capsuleKeys(), words.station("next")]).toEqual([
      "status",
      "blocker",
      "handoff",
      "next:",
    ]);
  });
});

describe("the T8 run seam — the capsule plugs into the lifecycle interaction point", () => {
  it("Capsule satisfies the CapsuleFace contact (attachCapsule's type)", () => {
    // Compile-time pin — fails under `tsc --noEmit` if the capsule's emit surface
    // drifts from the seam the run attaches (status · blocker · handoff · next).
    const seam: CapsuleFace = capsule;
    const lines = seam.emit("APPROVED", "0", "/ws/tasks-1-implement.json", { kind: "none" });
    expect(lines).toEqual([
      "status: APPROVED · blocker: 0 · handoff: /ws/tasks-1-implement.json",
      "next: none",
    ]);
  });
});

describe("the locale face — the word-table locale columns (T19, the P7 translation data)", () => {
  it("the locale key set — the langs projection source (the declared language keys)", () => {
    expect(words.localeKeys()).toEqual(["en", "zh"]);
  });

  it("the issue-label rows — one per finding type × segment (the label values ride the rows)", () => {
    expect(words.localeRow("bug.context")).toEqual({ en: "## Context", zh: "## 场景" });
    expect(words.localeRow("bug.problem")?.en).toBe("## Problem");
    expect(words.localeRow("enhancement.problem")?.en).toBe("## Gap");
    expect(words.localeRow("chore.suggestedFix")?.zh).toBe("## 建议方向");
    expect(words.localeRow("bug.bogus")).toBeNull();
  });

  it("the whole translation data flows from the one table — localeRows is the flat face", () => {
    const flat = words.localeRows();
    // the declared label matrix: 3 finding types × 4 segments = 12 rows, all single-sourced
    expect(flat.length).toBe(12);
    // every row's canonical is the en face and carries a zh alias (the two-locale steady face)
    for (const row of flat) {
      expect(row.en.length).toBeGreaterThan(0);
      expect(row.zh?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("the machine-face immunity — the capsule words carry zero locale aliases (never localized)", () => {
    const translator = new Translator(words);
    // the capsule machine words are not translation rows: normalize/localize over
    // the machine surface is null — the machine face is English-constant.
    expect(translator.normalize(words.station("next"))).toBeNull();
    expect(translator.normalize(words.station("blocked"))).toBeNull();
    expect(translator.localize("status", "zh")).toBeNull();
    expect(translator.localize("APPROVED", "zh")).toBeNull();
    // the byte pin stays English — the capsule emits the machine words verbatim
    expect(capsule.emit("APPROVED", "0", "/h.json", { kind: "none" })[1]).toBe("next: none");
  });
});
