// packages/kairos/tests/self-review-obligations.test.ts — the consumer-surface pins for
// P22 §7 (design spec "消费面义务"). The obligations live on the shipped SKILL.md face
// and nowhere else in the engine, so they are pinned by grep over the six products:
//
//   ① the self-review POINTER (×2) — `cdd-spec-writer` and `cdd-plan` name the
//      skill-anatomy contract's `SELF_REVIEW_OBLIGATIONS` registry instead of restating
//      the four questions (the registration itself is pinned in skill-anatomy.test.ts);
//   ② the APPROVAL GATE (×3) — every flow that dispatches the first NEXT-loop round
//      (`cdd-spec-writer` / `cdd-plan` / `cdd-dev`) submits the artifact and stops;
//   ③ the WRITE AUTHORITY (×3) — the same three state the three-way split (creation to
//      the orchestrator, content-face amendment to the dispatched round, structure face
//      to the orchestrator alone);
//   ④ the SUBMISSION declaration (×3) — the approval-gate sentence itself names the
//      authorship (`this document was written by the orchestrator in this session`);
//   ⑤ the ROUND-LOG pointer (×1, `cdd-dev`) — where the dispatch child's output lands
//      and which line names that path on failure;
//   ⑥ ZERO RESTATEMENT — no shipped SKILL.md re-words the severity rubric (the engine's
//      single source), so the consumer surface carries no second copy to drift.
//
// Zero module-level bare functions — the reader is a class (the repo's zero-`function`
// discipline applies to the kairos test plane too).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The shipped skills root — every pinned file resolves under it. */
const SKILLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../skills");

/** The closed six-skill roster on disk (the files this pin reads). */
const ROSTER = [
  "cdd-close",
  "cdd-design",
  "cdd-dev",
  "cdd-plan",
  "cdd-report",
  "cdd-spec-writer",
] as const;

/** The flows that author + dispatch the first NEXT-loop round (§7.2's three landing
 *  points) — the approval gate, the write authority and the submission line. */
const DISPATCH_OWNERS = ["cdd-spec-writer", "cdd-plan", "cdd-dev"] as const;

/** The flows whose `self-review` node points at the contract's registry (§7.1). */
const SELF_REVIEW_POINTERS = ["cdd-spec-writer", "cdd-plan"] as const;

/** The pinned surface tokens — one spelling per obligation (the shipped word face). */
const TOKENS = {
  registry: "SELF_REVIEW_OBLIGATIONS",
  approvalGate: "**Approval gate**",
  writeAuthority: "**Write authority**",
  submission: "this document was written by the orchestrator in this session",
  roundLog: ".kairos/cdd/<slug>/logs/",
  blockedChannel: "`CDD_BLOCKED`",
} as const;

/** The severity rubric's anchor phrases — the engine's ONE source; a SKILL.md that
 *  repeats any of them has shipped a second copy of the rubric (§2's zero-restatement
 *  rule). */
const RUBRIC_RESTATEMENTS = ["declared acceptance gate", "a legal input escapes", "set aside"];

/** The four self-review questions' titles — registered in the contract (§7.1); a
 *  pointer must not carry a second copy of the body. */
const QUESTION_TITLES = [
  "Evidence before assertion",
  "Two-axis self-check",
  "Fix what the self-check finds",
  "A self-check never replaces the review",
];

/**
 * The shipped SKILL.md face — read once, queried per skill. `carrying` / `sentenceOf`
 * are the two grep shapes the pins need (a file hit vs the ONE sentence that carries a
 * clause, so "the submission line sits inside the approval-gate sentence" is checkable).
 */
class SkillSurface {
  readonly #texts: ReadonlyMap<string, string>;

  private constructor(texts: ReadonlyMap<string, string>) {
    this.#texts = texts;
  }

  /** Read every roster member's SKILL.md. */
  static of(): SkillSurface {
    const texts = new Map<string, string>();
    for (const skill of ROSTER) {
      texts.set(skill, readFileSync(path.join(SKILLS_DIR, skill, "SKILL.md"), "utf8"));
    }
    return new SkillSurface(texts);
  }

  /** One skill's shipped text (a missing roster member is a hard failure). */
  text(skill: string): string {
    const text = this.#texts.get(skill);
    if (text === undefined) throw new Error(`the roster carries no ${skill} SKILL.md`);
    return text;
  }

  /** The roster members whose text carries a token, in roster order. */
  carrying(token: string): readonly string[] {
    return ROSTER.filter((skill) => this.text(skill).includes(token));
  }

  /** The ONE clause carrying a token — from the token to the next bolded clause start
   *  (or the end of the line), so a clause written as several sentences stays whole. */
  clauseOf(skill: string, token: string): string {
    const text = this.text(skill);
    const start = text.indexOf(token);
    if (start === -1) return "";
    const rest = text.slice(start + token.length);
    const next = rest.search(/\s\*\*[A-Z]/);
    return next === -1 ? (rest.split("\n")[0] ?? "") : rest.slice(0, next);
  }
}

const SURFACE = SkillSurface.of();

describe("P22 §7.1 — the four self-review questions are pointed at, never restated", () => {
  it("the pointer lands in exactly the two authoring flows and in no other skill", () => {
    expect(SURFACE.carrying(TOKENS.registry)).toEqual([...SELF_REVIEW_POINTERS].sort());
  });
});

describe("P22 §7.2 — the approval gate lives with the dispatcher, in exactly three flows", () => {
  it("the gate sentence lands in the authoring flows and the executor, and nowhere else", () => {
    expect(SURFACE.carrying(TOKENS.approvalGate)).toEqual([...DISPATCH_OWNERS].sort());
  });

  it("each gate stops the dispatch until the author explicitly approves", () => {
    for (const skill of DISPATCH_OWNERS) {
      const sentence = SURFACE.clauseOf(skill, TOKENS.approvalGate);
      expect(sentence, `${skill} carries no approval-gate clause`).not.toBe("");
      expect(sentence, `${skill}'s gate does not stop before the dispatch`).toMatch(
        /submit .* to the author and stop/,
      );
      expect(sentence, `${skill}'s gate does not require an explicit approval`).toContain(
        "dispatch only after an explicit approval",
      );
    }
  });
});

describe("P22 §7.3 — the write authority is stated three ways in the same three flows", () => {
  it("the write-authority clause lands in the authoring flows and the executor", () => {
    expect(SURFACE.carrying(TOKENS.writeAuthority)).toEqual([...DISPATCH_OWNERS].sort());
  });

  it("each clause separates the content face from the structure face", () => {
    for (const skill of DISPATCH_OWNERS) {
      const sentence = SURFACE.clauseOf(skill, TOKENS.writeAuthority);
      expect(sentence, `${skill} carries no write-authority clause`).not.toBe("");
      expect(sentence, `${skill} grants no content-face amendment`).toContain("content face");
      expect(sentence, `${skill} does not reserve the structure face`).toContain("structure face");
      expect(sentence, `${skill} does not reserve creation to the orchestrator`).toContain(
        "written in this session",
      );
    }
  });
});

describe("P22 §7.3 — the submission line names the authorship, inside the gate sentence", () => {
  it("each approval-gate sentence carries the submission declaration", () => {
    expect(SURFACE.carrying(TOKENS.submission)).toEqual([...DISPATCH_OWNERS].sort());
    for (const skill of DISPATCH_OWNERS) {
      expect(
        SURFACE.clauseOf(skill, TOKENS.approvalGate),
        `${skill}'s submission line is not inside the approval-gate sentence`,
      ).toContain(TOKENS.submission);
    }
  });
});

describe("P22 §4 — the dispatch child's output has one named home (`cdd-dev`)", () => {
  it("the executor names the log path and the failing round's CDD_BLOCKED pointer", () => {
    expect(SURFACE.carrying(TOKENS.roundLog)).toEqual(["cdd-dev"]);
    const sentence = SURFACE.clauseOf("cdd-dev", TOKENS.roundLog);
    expect(sentence).toContain(TOKENS.blockedChannel);
    expect(sentence).toContain("stderr");
  });
});

describe("P22 §7.1 — the pointers carry no second copy of the questions", () => {
  it("no shipped SKILL.md restates a self-review question", () => {
    for (const skill of ROSTER) {
      for (const title of QUESTION_TITLES) {
        expect(
          SURFACE.text(skill).includes(title),
          `${skill} restates the question "${title}" instead of pointing at the registry`,
        ).toBe(false);
      }
    }
  });
});

describe("P22 §2 — the severity rubric is stated once, in the engine", () => {
  it("no shipped SKILL.md restates a rubric anchor phrase", () => {
    for (const skill of ROSTER) {
      for (const phrase of RUBRIC_RESTATEMENTS) {
        expect(
          SURFACE.text(skill).includes(phrase),
          `${skill} restates the severity rubric ("${phrase}")`,
        ).toBe(false);
      }
    }
  });
});
