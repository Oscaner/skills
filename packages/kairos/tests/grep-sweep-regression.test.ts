// packages/kairos/tests/grep-sweep-regression.test.ts — P13 grep sweep regression guard
// Verifies all deleted-skill tokens remain zero in the in-scope tree.

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");

// The docs-root exclusion suffixes — the historical spec/plan records under
// `docs/kairos/` legitimately carry the swept tokens (frozen history), so the sweeps
// must exclude them. Single source: these grep sweeps are the only consumer (the old
// scripts/lib/doc-root.ts helper died with the cutover — the values fold here).
const DOC_ROOT_SEGMENTS = ["docs", "kairos"] as const;
const DOC_ROOT_EXCLUDE_PATHS = ["specs", "plans"].map(
  (seg) => `${DOC_ROOT_SEGMENTS.join("/")}/${seg}/`,
);

// Exclusion suffixes derive from the segments, never hand-written in the chain.
const DOC_ROOT_EXCLUDES = DOC_ROOT_EXCLUDE_PATHS.map((p) => `| grep -v "${p}" `).join("");
const DOC_ROOT_PREFIX = `| grep -v "${DOC_ROOT_SEGMENTS.join("/")}/" `;

const grepCount = (pattern: string, extraArgs = "") => {
  try {
    const cmd = `grep -rn "${pattern}" ${extraArgs} packages/ docs/ README.md marketplace/source.json --include="*.md" --include="*.json" --include="*.ts" 2>/dev/null | grep -v "/CHANGELOG.md" ${DOC_ROOT_EXCLUDES}| grep -v "grep-sweep-regression.test.ts" | wc -l`;
    return parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  } catch {
    return 0;
  }
};

// Tokens that must be zero in-scope
const TOKENS = [
  ["kairos:debugging", "deleted skill"],
  ["skills/debugging/", "deleted skill path"],
  ["kairos:verification", "deleted skill"],
  ["skills/verification/", "deleted skill path"],
  ["cli-task", "deleted skill"],
  ["subagent-lifecycle", "dissolved doc (excl. anti-regression guards + dissolution statements)"],
  ["executing-plans", "renamed skill"],
  ["cli-code-review", "deleted skill"],
  ["review-dispatch", "dissolved doc"],
];

// Tokens requiring SKILL.md-only scope filter
const SKILL_ONLY_TOKENS = [
  ["HARD-GATE", "old format keyword"],
  ["## Rules", "old format heading (H1/H2)"],
  ["## Red Flags", "old format heading (H1/H2)"],
  ["## Checklist", "old format heading"],
];

for (const [token, desc] of TOKENS) {
  test(`grep sweep: "${token}" (${desc}) → 0 hits`, () => {
    const count = grepCount(token);
    expect(count, `"${token}" has ${count} in-scope hits — expected 0`).toBe(0);
  });
}

// SKILL.md-only tokens (old format headings)
for (const [token, desc] of SKILL_ONLY_TOKENS) {
  test(`grep sweep: "${token}" in SKILL.md (${desc}) → 0 hits`, () => {
    const cmd = `grep -rn "${token}" packages/kairos/skills/ --include="SKILL.md" 2>/dev/null | wc -l`;
    const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
    expect(count, `"${token}" found in ${count} SKILL.md files`).toBe(0);
  });
}

// --prompt (exclude bin/engine/tests/)
test('grep sweep: "--prompt" in live code (excl. engine tests) → 0 hits', () => {
  // The tree-migration.test.ts exclusion: T5's spec-verbatim pins carry the ORIGINAL acceptance
  // text of the migrated legacy specs (frozen spec history — the same class as CHANGELOG.md),
  // and osuperpowers-overhaul P2's AC4 verbatim mentions the `--prompt` sweep. The pin carries
  // history, it does not introduce the retired convention into live code. T6's plan-migration
  // pins fixture (plan-migration-pins.json) carries the same frozen-history class on the plan side.
  const cmd = `grep -rn "\\-\\-prompt" packages/ --include="*.md" --include="*.json" --include="*.ts" 2>/dev/null | grep -v "/CHANGELOG.md" | grep -v "bin/engine/tests/" | grep -v "grep-sweep-regression.test.ts" | grep -v "tree-migration.test.ts" | grep -v "plan-migration-pins.json" | wc -l`;
  const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  expect(count, `"--prompt" has ${count} live-code hits`).toBe(0);
});

// docs/cdd-reference old path (should not appear as ../docs/cdd-reference)
// T16 Step 5: the cdd-dev/docs/cdd-reference exclusion filter is
// dropped — that doc tree is gone (the namespace/schema docs were deleted in P4),
// the filter is dead (measured 0 hits either way) and would mask a future
// re-appearance of the old path.
test('grep sweep: "docs/cdd-reference" old path → 0 hits', () => {
  const cmd = `grep -rn "docs/cdd-reference" packages/ docs/ --include="*.md" --include="*.json" 2>/dev/null | grep -v "/CHANGELOG.md" ${DOC_ROOT_PREFIX}| grep -v "grep-sweep-regression.test.ts" | wc -l`;
  const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  expect(count, `"docs/cdd-reference" old path has ${count} hits`).toBe(0);
});

// Special token: subagent-driven-development (allowed in vendor path + maintainer docs)
test("grep sweep: subagent-driven-development in non-vendor/non-maintainer code → 0 hits", () => {
  const cmd = `grep -rn "subagent-driven-development" packages/kairos/skills/ docs/ README.md marketplace/source.json --include="*.md" --include="*.json" --include="*.ts" 2>/dev/null | grep -v "/CHANGELOG.md" ${DOC_ROOT_EXCLUDES}| grep -v "grep-sweep-regression.test.ts" | grep -v "docs/maintainers/" | wc -l`;
  const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  expect(count, `subagent-driven-development has ${count} non-vendor/non-maintainer hits`).toBe(0);
});

// P7 §8.4 — the consumer-face lexicon sweep. The engine retired the commit-sha scope
// vocabulary (WAVE_BASE / FIX_BASE / INPUT_RANGE / INPUT_PLAN / OUTPUT_BRIEF) and the
// branch review's `--head` flag; the consumer prose that ships to harness users (the
// kairos skills + the README family, both languages) must carry zero residual. The
// engine's own source face is pinned separately in its suite (cli.test.ts); this sweep
// owns the shipped-prose surface, whose ownership is the kairos plane (the consumer
// story lives here). The frozen history under docs/kairos/{specs,plans} is exempt (the
// historical design/plan records legitimately name the retired forms) — those paths are
// outside this scan set by construction.
test("grep sweep: the retired consumer-face lexicon in shipped prose → 0 hits", () => {
  // The consumer-prose scan set — the kairos skills + the README family (root + the two
  // packages, EN + zh), where a consumer reads the CLI contract. `--head` is pinned as
  // the retired branch-review flag; `--base` alone stays legal (base set --base <branch>).
  const surfaces = [
    "packages/kairos/skills/",
    "packages/kairos/README.md",
    "packages/kairos/README.zh-CN.md",
    "packages/cdd-engine/README.md",
    "packages/cdd-engine/README.zh-CN.md",
    "README.md",
    "README.zh-CN.md",
  ].join(" ");
  const cmd = `grep -rn -e "WAVE_BASE" -e "FIX_BASE" -e "INPUT_RANGE" -e "INPUT_PLAN" -e "OUTPUT_BRIEF" -e "\\-\\-head" ${surfaces} --include="*.md" 2>/dev/null | grep -v "/CHANGELOG.md" | wc -l`;
  const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  expect(count, `retired consumer-face lexicon has ${count} shipped-prose hits — expected 0`).toBe(
    0,
  );
});
