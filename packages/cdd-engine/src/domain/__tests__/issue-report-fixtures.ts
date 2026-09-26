// packages/cdd-engine/src/domain/__tests__/issue-report-fixtures.ts — the shared golden corpus
// for the `cdd issue render` migration (P4.2 Task 6: the renderer's determinism tests moved from
// packages/osuperpowers/tests/report-templates.test.mjs into the engine test plane). The golden
// body is an independent hand-written literal (same-bytes with the retired report-templates.mjs
// samples — the assertion compares the renderer output against THIS literal, never a recompute);
// the INPUT finds exercise mixed type × lang, N findings, and the full related shape (open /
// closed / program). Imported by both the domain service test and the CLI black-box test so the
// byte-parity reference stays a single literal.

export const INPUT = {
  harness: "claude-code",
  findings: [
    {
      type: "bug",
      lang: "en",
      context: "Ran branch-review on cdd-engine-overhaul-p4",
      problem: "Stopped before emitting findings",
      impact: "Blocked the whole phase",
      suggestedFix: "Skip idempotent reruns",
      meta: { skill: "cli-driven-development", step: "3-2" },
    },
    {
      type: "enhancement",
      lang: "zh",
      context: "重复 fix 循环无上限",
      problem: "fix 轮次由 reviewer 全量重跑",
      impact: "浪费 token",
      suggestedFix: "引入 review convergence 配额",
      meta: { skill: "writing-plans", step: "5-1" },
    },
  ],
  related: {
    open: [{ issue: 231, component: "cdd-engine", reason: "timeout on rerun" }],
    closed: [{ issue: 230 }],
    program: { issue: 262 },
  },
};

/** The byte-parity reference — the pre-migration report-templates.mjs aggregate-body output,
 *  kept byte-identical (layout pinned: Session one line → finding blocks × N → Dedup/Related
 *  single tail). No trailing newline — the CLI appends it. */
export const GOLDEN_BODY = `## Session
- Harness: claude-code

## Context

Ran branch-review on cdd-engine-overhaul-p4

## Problem

Stopped before emitting findings

## Impact

Blocked the whole phase

## Suggested fix

Skip idempotent reruns
- Skill: cli-driven-development
- Step: 3-2

## 背景

重复 fix 循环无上限

## 当前行为

fix 轮次由 reviewer 全量重跑

## 期望行为

浪费 token

## 建议方案

引入 review convergence 配额
- Skill: writing-plans
- Step: 5-1

## Dedup
- Dedup → #231 (open)：cdd-engine · timeout on rerun

## Related
- Regression / follow-up of #230 (closed)
- Program: #262`;

export const VALID_FINDING = {
  type: "bug",
  lang: "en",
  context: "c",
  problem: "p",
  impact: "i",
  suggestedFix: "f",
  meta: { skill: "cli-driven-development", step: "3-2" },
};

/** The single-finding body (the VALID_FINDING input) — a second independent hand-written literal
 *  used by the zero-enforcement CLI case. */
export const SINGLE_FINDING_BODY = `## Session
- Harness: claude-code

## Context

c

## Problem

p

## Impact

i

## Suggested fix

f
- Skill: cli-driven-development
- Step: 3-2`;

export function validInput() {
  return { harness: "claude-code", findings: [VALID_FINDING] };
}
