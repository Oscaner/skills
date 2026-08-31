// packages/osuperpowers/tests/grep-sweep-regression.test.mjs — P13 grep sweep regression guard
// Verifies all deleted-skill tokens remain zero in the in-scope tree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");

function grepCount(pattern, extraArgs = "") {
  try {
    const cmd = `grep -rn "${pattern}" ${extraArgs} packages/ docs/ README.md marketplace/source.json --include="*.md" --include="*.json" --include="*.mjs" 2>/dev/null | grep -v "/CHANGELOG.md" | grep -v "docs/superpowers/specs/" | grep -v "docs/superpowers/plans/" | grep -v "docs/superpowers/tickets/" | grep -v "validate-overrides-build.mjs" | grep -v "docs/maintainers/osuperpowers-plugin" | grep -v "docs/maintainers/osuperpowers-router-plugin" | grep -v "skill-authoring.md" | grep -v "grep-sweep-regression.test.mjs" | wc -l`;
    return parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  } catch { return 0; }
}

// Tokens that must be zero in-scope
const TOKENS = [
  ["osuperpowers:debugging", "deleted skill"],
  ["skills/debugging/", "deleted skill path"],
  ["osuperpowers:verification", "deleted skill"],
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
    assert.equal(count, 0, `"${token}" has ${count} in-scope hits — expected 0`);
  });
}

// SKILL.md-only tokens (old format headings)
for (const [token, desc] of SKILL_ONLY_TOKENS) {
  test(`grep sweep: "${token}" in SKILL.md (${desc}) → 0 hits`, () => {
    const cmd = `grep -rn "${token}" packages/osuperpowers/skills/ --include="SKILL.md" 2>/dev/null | wc -l`;
    const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
    assert.equal(count, 0, `"${token}" found in ${count} SKILL.md files`);
  });
}

// --prompt (exclude bin/engine/tests/)
test('grep sweep: "--prompt" in live code (excl. engine tests) → 0 hits', () => {
  const cmd = `grep -rn "\\-\\-prompt" packages/ --include="*.md" --include="*.json" --include="*.mjs" 2>/dev/null | grep -v "/CHANGELOG.md" | grep -v "bin/engine/tests/" | grep -v "grep-sweep-regression.test.mjs" | wc -l`;
  const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  assert.equal(count, 0, `"--prompt" has ${count} live-code hits`);
});

// docs/cdd-reference old path (should not appear as ../docs/cdd-reference)
test('grep sweep: "docs/cdd-reference" old path → 0 hits', () => {
  const cmd = `grep -rn "docs/cdd-reference" packages/ docs/ --include="*.md" --include="*.json" 2>/dev/null | grep -v "/CHANGELOG.md" | grep -v "docs/superpowers/" | grep -v "cli-driven-development/docs/cdd-reference" | grep -v "grep-sweep-regression.test.mjs" | wc -l`;
  const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  assert.equal(count, 0, `"docs/cdd-reference" old path has ${count} hits`);
});

// Special token: subagent-driven-development (allowed in vendor path + router routing + maintainer docs)
test("grep sweep: subagent-driven-development in non-vendor/non-router/non-maintainer code → 0 hits", () => {
  const cmd = `grep -rn "subagent-driven-development" packages/osuperpowers/skills/ packages/osuperpowers-router/skills/ docs/ README.md marketplace/source.json --include="*.md" --include="*.json" --include="*.mjs" 2>/dev/null | grep -v "/CHANGELOG.md" | grep -v "docs/superpowers/specs/" | grep -v "docs/superpowers/plans/" | grep -v "docs/superpowers/tickets/" | grep -v "runner.mjs" | grep -v "runner.test.mjs" | grep -v "overrides.manifest.json" | grep -v "prompt-expansion.mjs" | grep -v "cursor-detect.mjs" | grep -v "docs/maintainers/" | wc -l`;
  const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  assert.equal(count, 0, `subagent-driven-development has ${count} non-vendor/non-router/non-maintainer hits`);
});
