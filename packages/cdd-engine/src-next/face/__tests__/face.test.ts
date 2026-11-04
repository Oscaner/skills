// packages/cdd-engine/src-next/face/__tests__/face.test.ts
// T10 Words + Capsule suite (design spec §1.2 / §3.2):
//   · the word table — the three families served by one instance (the capsule
//     station words, the guard ban words, the locale rows), with zero second
//     tables — the capsule's every emitted word is
//     looked up on the same Words instance;
//   · the byte pin — Capsule#emit renders the `status · handoff` line and the
//     optional `next:` + `reason:` rows byte-stably (every route row rendered,
//     the two route rows last);
//   · the word-face comparison — the v1 emitted face is byte-identical to the
//     existing consumed word face (status · handoff · next:) — same words, no
//     re-judgment: a steady state, not a compatibility shim;
//   · the locale face (T19) — the word table's locale columns: the locale key set
//     (the langs projection source), the issue-label rows (one per finding type ×
//     segment) + the charter anchor rows (the P7 canonicalize data — charter.*), and
//     the machine-face immunity — the capsule words carry zero locale aliases (the
//     machine surface is English-constant, never localized).
// The type assertion at the bottom pins the T8 run seam (CapsuleFace) — the
// interaction point the lifecycle attaches.

import { describe, expect, it } from "vitest";
import { Translator } from "../../contract/translate.ts";
import type { RouteTarget } from "../../session/faces.ts";
import {
  FIX_READBACK_SUFFIX,
  NEXT_HOP_REASON,
  type NextHop,
  NextStepRouter,
  type Route,
} from "../../session/next.ts";
import type { CapsuleFace } from "../../session/run.ts";
import { Capsule } from "../capsule.ts";
import { CAPSULE_WORDS, GUARD_BAN_WORDS, Words } from "../words.ts";

const words = new Words();
const capsule = new Capsule(words);

/** The capsule's ONE input object — a `NextHop` produced by the ONE derivation
 *  (never a hand-built shape), so the render pins the derivation's own product. */
const hopOf = (route: Route, target: RouteTarget | null = null): NextHop =>
  new NextStepRouter().nextHop({
    target,
    gate: { drift: false },
    route,
    verdict: target === null ? "terminal" : "phase-spec",
  });

describe("the word table — one table, three families", () => {
  it("the capsule family — the pinned keys, the stations, the status vocabulary", () => {
    // The key set is a function of the status class + the crash-record fact: a
    // success status renders the two-key face; a failure status (TIMEOUT / BLOCKED)
    // keeps handoff only when a crash record was written.
    expect(words.capsuleKeys("APPROVED", true)).toEqual(["status", "handoff"]);
    expect(words.capsuleKeys("CHANGES_REQUESTED", false)).toEqual(["status", "handoff"]);
    expect(words.capsuleKeys("REVIEW_FIX", true)).toEqual(["status", "handoff"]);
    expect(words.capsuleKeys("TIMEOUT", false)).toEqual(["status"]);
    expect(words.capsuleKeys("BLOCKED", false)).toEqual(["status"]);
    expect(words.capsuleKeys("TIMEOUT", true)).toEqual(["status", "handoff"]);
    expect(words.capsuleKeys("BLOCKED", true)).toEqual(["status", "handoff"]);
    expect(words.capsuleSeparator()).toBe(" · ");
    expect(words.statusVocab()).toEqual([
      "APPROVED",
      "BLOCKED",
      "CHANGES_REQUESTED",
      "REVIEW_FIX",
      "TIMEOUT",
    ]);
    expect(words.station("next")).toBe("next:");
    expect(words.station("reason")).toBe("reason:");
    expect(words.station("blocked")).toBe("CDD_BLOCKED:");
    expect(words.station("warn")).toBe("CDD_WARN:");
    expect(words.station("cliMissing")).toBe("CDD_CLI_MISSING:");
    expect(words.routeWord("done")).toBe("done");
    expect(words.routeWord("review")).toBe("review");
    expect(words.routeWord("fix")).toBe("fix");
    expect(words.routeWord("implement")).toBe("implement");
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
    const emitted = capsule.emit(
      "APPROVED",
      "/ws/tasks-1-implement.json",
      hopOf({ kind: "review" }),
    );
    // the emitted keys ARE the table's keys, in the table's order — no parallel list
    const keysOf = emitted[0]
      .split(words.capsuleSeparator())
      .map((cell) => cell.slice(0, cell.indexOf(": ")));
    expect(keysOf).toEqual([...words.capsuleKeys("APPROVED", true)]);
    // both route station words in the output are the table's own (`next:` then
    // `reason:`) — a hard-coded anchor would pass the byte pin alone
    expect(emitted[1].split(" ")[0]).toBe(words.station("next"));
    // the reason row rides the table too — a hard-coded `reason:` would pass the
    // byte pin alone, so the second route station is asserted here
    expect(emitted[2].split(" ")[0]).toBe(words.station("reason"));
    expect(Object.values(CAPSULE_WORDS.stations).length).toBe(5);
  });
});

describe("the capsule byte pin — the single output face", () => {
  it("renders the capsule line byte-stably (the status-class key set)", () => {
    expect(capsule.emit("APPROVED", "/ws/tasks-1-implement.json")).toEqual([
      "status: APPROVED · handoff: /ws/tasks-1-implement.json",
    ]);
    // A failure status renders the status cell alone — the handoff cell rides it only
    // when a crash record exists, and no blocker cell was ever part of this face.
    expect(capsule.emit("BLOCKED", "/ws/branch-review-a1b2c3d..e4f5g6h-r1.json")).toEqual([
      "status: BLOCKED",
    ]);
    // …and keeps handoff only when the round wrote a crash record (withHandoff).
    expect(capsule.emit("TIMEOUT", "/ws/crash-improve.wave-1.json", null, true)).toEqual([
      "status: TIMEOUT · handoff: /ws/crash-improve.wave-1.json",
    ]);
  });

  it("renders the `next:` line per the C5 route row (each kind, only present facts)", () => {
    expect(capsule.emit("APPROVED", "/h.json", hopOf({ kind: "done" }))).toEqual([
      "status: APPROVED · handoff: /h.json",
      "next: done",
      "reason: face-closed",
    ]);
    expect(capsule.emit("APPROVED", "/h.json", hopOf({ kind: "next-wave", tasks: "7,9" }))).toEqual(
      [
        "status: APPROVED · handoff: /h.json",
        // P4.1 T4 — the complete executable literal; the absent target seeds the
        // `<plan>` placeholder (the crash-resume's own seed convention)
        "next: implement --plan <plan> --tasks 7,9",
        "reason: task-open",
      ],
    );
    expect(capsule.emit("REVIEW_FIX", "/h.json", hopOf({ kind: "review" }))).toEqual([
      "status: REVIEW_FIX · handoff: /h.json",
      // the bare review fallback (no target — the type discriminator is absent)
      "next: review",
      "reason: task-open",
    ]);
    expect(
      capsule.emit(
        "CHANGES_REQUESTED",
        "/h.json",
        hopOf({ kind: "fix", reviews: "tasks-1-review-1.json" }),
      ),
    ).toEqual([
      "status: CHANGES_REQUESTED · handoff: /h.json",
      `next: fix --reviews tasks-1-review-1.json ${FIX_READBACK_SUFFIX}`,
      "reason: pending-fix",
    ]);
    // a fix route without its input renders the bare classifier
    expect(capsule.emit("CHANGES_REQUESTED", "/h.json", hopOf({ kind: "fix" }))).toEqual([
      "status: CHANGES_REQUESTED · handoff: /h.json",
      "next: fix",
      "reason: pending-fix",
    ]);
    // the soft-cap message rides verbatim — the user-adjudication station
    expect(
      capsule.emit(
        "BLOCKED",
        "/h.json",
        hopOf({ kind: "soft-cap", message: "BLOCKED: review-cycle-cap — user adjudicates" }),
      ),
    ).toEqual([
      "status: BLOCKED",
      "next: BLOCKED: review-cycle-cap — user adjudicates",
      "reason: soft-cap",
    ]);
  });

  it("renders the complete executable `next:` literal with the frame's RouteTarget (P4.1 T4)", () => {
    const target = { type: "wave", id: "1,2", plan: "docs/kairos/plans/p.md" } as const;
    // a re-review of a wave — `review --type wave --tasks {tasks} --plan <path>`
    // (the review carries no commit ref; parse needs type + tasks, the
    // runtime-required --plan rides the frame's plan fact — find #7)
    expect(capsule.emit("REVIEW_FIX", "/h.json", hopOf({ kind: "review" }, target))).toEqual([
      "status: REVIEW_FIX · handoff: /h.json",
      "next: review --type wave --tasks 1,2 --plan docs/kairos/plans/p.md",
      "reason: task-open",
    ]);
    // the one-way fix hop — `fix --type wave --tasks {tasks} --plan <p> --reviews <f>`
    expect(
      capsule.emit(
        "CHANGES_REQUESTED",
        "/h.json",
        hopOf({ kind: "fix", reviews: "tasks-1,2-review-1.json" }, target),
      ),
    ).toEqual([
      "status: CHANGES_REQUESTED · handoff: /h.json",
      `next: fix --type wave --tasks 1,2 --plan docs/kairos/plans/p.md --reviews tasks-1,2-review-1.json ${FIX_READBACK_SUFFIX}`,
      "reason: pending-fix",
    ]);
    // the other target types render their discriminator arg — branch (the
    // workspace --plan only — the review judges the live tree, no range rides the
    // command · the scope anchor BASE_BRANCH is engine-injected at dispatch)
    expect(
      capsule.emit(
        "REVIEW_FIX",
        "/h.json",
        hopOf({ kind: "review" }, { type: "branch", id: "branch", plan: "docs/kairos/plans/p.md" }),
      ),
    ).toEqual([
      "status: REVIEW_FIX · handoff: /h.json",
      "next: review --type branch --plan docs/kairos/plans/p.md",
      "reason: task-open",
    ]);
    expect(
      capsule.emit(
        "REVIEW_FIX",
        "/h.json",
        hopOf({ kind: "review" }, { type: "phase-spec", id: "docs/kairos/specs/x-design.md" }),
      ),
    ).toEqual([
      "status: REVIEW_FIX · handoff: /h.json",
      "next: review --type phase-spec --spec docs/kairos/specs/x-design.md",
      "reason: task-open",
    ]);
    // implement renders NO `--type` — the single-type wave verb (the declaration's
    // `parsed.args.type ?? "wave"` default unchanged; the plan rides the plan path)
    expect(
      capsule.emit("APPROVED", "/h.json", hopOf({ kind: "next-wave", tasks: "1,2" }, target)),
    ).toEqual([
      "status: APPROVED · handoff: /h.json",
      "next: implement --plan docs/kairos/plans/p.md --tasks 1,2",
      "reason: task-open",
    ]);
  });

  it("renders the hop's reason on its own line right after `next:`", () => {
    const review = capsule.emit("APPROVED", "/h.json", hopOf({ kind: "review" }));
    expect(review[review.length - 1]).toBe(`reason: ${NEXT_HOP_REASON.taskOpen}`);
    const fix = capsule.emit("CHANGES_REQUESTED", "/h.json", hopOf({ kind: "fix" }));
    expect(fix[fix.length - 1]).toBe(`reason: ${NEXT_HOP_REASON.pendingFix}`);
    // the row follows `next:` — it never replaces or precedes it
    expect(review[review.length - 2]).toBe("next: review");
  });

  it("an ABSENT NextHop emits no `next:` line — `hop: null` still prints its frozen row", () => {
    // The failure face: the object is absent (never a `hop: null` shape), so no
    // second line rides the capsule.
    expect(capsule.emit("BLOCKED", "/h.json")).toEqual(["status: BLOCKED"]);
    expect(capsule.emit("TIMEOUT", "/h.json", null)).toEqual(["status: TIMEOUT"]);
    // The counterexample the frozen table rests on: a PRESENT object whose `hop` is
    // null (`done` with no target → the terminal row) still prints `next: done`.
    expect(capsule.emit("APPROVED", "/h.json", hopOf({ kind: "done" }))).toEqual([
      "status: APPROVED · handoff: /h.json",
      "next: done",
      "reason: face-closed",
    ]);
  });

  it("the retired blocker cell — the grade rides `status`, the line carries two keys", () => {
    // The count that used to ride its own cell is derivable from the status (any
    // blocker ⇒ CHANGES_REQUESTED), so the line stays two keys on every grade.
    expect(capsule.emit("CHANGES_REQUESTED", "/h.json")[0]).toBe(
      "status: CHANGES_REQUESTED · handoff: /h.json",
    );
    expect(capsule.emit("CHANGES_REQUESTED", "/h.json")[0]).not.toContain("blocker:");
  });
});

describe("the word-face comparison — v1 face vs the existing consumed face", () => {
  it("the v1 emitted word face is byte-identical to the existing consumed face (same words, no re-judgment)", () => {
    // The existing machine face consumers grep / route on — the steady vocabulary
    // (status · handoff · next:). v1 keeps the same words: a rename breaks this
    // literal pin — a steady state, never a compatibility shim.
    expect(capsule.emit("APPROVED", "/ws/tasks-1-implement.json")[0]).toBe(
      "status: APPROVED · handoff: /ws/tasks-1-implement.json",
    );
    // the word cells of the face, in the emitted order — the existing consumed
    // order the comparison keys on
    expect([...words.capsuleKeys("APPROVED", false), words.station("next")]).toEqual([
      "status",
      "handoff",
      "next:",
    ]);
  });
});

describe("the T8 run seam — the capsule plugs into the lifecycle interaction point", () => {
  it("Capsule satisfies the CapsuleFace contact (attachCapsule's type)", () => {
    // Compile-time pin — fails under `tsc --noEmit` if the capsule's emit surface
    // drifts from the seam the run attaches (status · handoff · next).
    const seam: CapsuleFace = capsule;
    const lines = seam.emit("APPROVED", "/ws/tasks-1-implement.json", hopOf({ kind: "done" }));
    expect(lines).toEqual([
      "status: APPROVED · handoff: /ws/tasks-1-implement.json",
      "next: done",
      "reason: face-closed",
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

  it("the charter rows — the P7 canonicalize data (the zh knowledge's single home)", () => {
    expect(words.localeRow("charter.group-leaf")).toEqual({ en: "group", zh: "组" });
    expect(words.localeRow("charter.upstream-endorsements")).toEqual({
      en: "Upstream Endorsements",
      zh: "上游先例背书",
    });
    expect(words.localeRow("charter.bogus")).toBeNull();
  });

  it("the whole translation data flows from the one table — localeRows is the flat face", () => {
    const flat = words.localeRows();
    // the declared locale matrix: 3 finding types × 4 segments = 12 issue-label rows
    // + 2 charter anchor rows = 14, all single-sourced
    expect(flat.length).toBe(14);
    // every row's canonical is the en face and carries a zh alias (the two-locale steady face)
    for (const row of flat) {
      expect(row.en.length).toBeGreaterThan(0);
      expect(row.zh?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("the machine-face immunity — the capsule words carry zero locale aliases (never localized)", () => {
    const translator = new Translator(words);
    // the capsule machine words are not translation rows: canonicalize over the
    // machine surface is identity (no registered alias span) — the machine face is
    // English-constant.
    expect(translator.canonicalize(words.station("next"))).toBe("next:");
    expect(translator.canonicalize(words.station("blocked"))).toBe("CDD_BLOCKED:");
    expect(translator.localize("status", "zh")).toBeNull();
    expect(translator.localize("APPROVED", "zh")).toBeNull();
    // the byte pin stays English — the capsule emits the machine words verbatim
    expect(capsule.emit("APPROVED", "/h.json", hopOf({ kind: "done" }))[1]).toBe("next: done");
  });
});
