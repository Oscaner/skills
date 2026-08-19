import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Router behavior contract: UserPromptExpansion command → injected additionalContext
// that forces Skill(<target>) as the first tool call. The trigger → target mapping
// must mirror overrides.manifest.json exactly.
const ROUTER = fileURLToPath(
  new URL("../../osuperpowers-router/bin/prompt-expansion.mjs", import.meta.url),
);

function run(input) {
  return execFileSync("node", [ROUTER], { input, encoding: "utf8" });
}

function runCommand(commandName) {
  return run(JSON.stringify({ command_name: commandName }));
}

function context(out) {
  return JSON.parse(out).additionalContext;
}

test("prompt-expansion: superpowers:brainstorming → Skill(osuperpowers:brainstorming)", () => {
  const ctx = context(runCommand("superpowers:brainstorming"));
  assert.match(ctx, /MANDATORY OVERRIDE/);
  assert.match(ctx, /Skill\(osuperpowers:brainstorming\)/);
});

test("prompt-expansion: bare /brainstorming → Skill(osuperpowers:brainstorming)", () => {
  const ctx = context(run("/brainstorming"));
  assert.match(ctx, /Skill\(osuperpowers:brainstorming\)/);
});

test("prompt-expansion: superpowers:writing-plans → Skill(osuperpowers:writing-plans)", () => {
  const ctx = context(runCommand("superpowers:writing-plans"));
  assert.match(ctx, /Skill\(osuperpowers:writing-plans\)/);
});

test("prompt-expansion: superpowers:subagent-driven-development → Skill(osuperpowers:cli-driven-development)", () => {
  const ctx = context(runCommand("superpowers:subagent-driven-development"));
  assert.match(ctx, /Skill\(osuperpowers:cli-driven-development\)/);
});

test("prompt-expansion: superpowers:test-driven-development → Skill(mattpocock-skills:tdd)", () => {
  const ctx = context(runCommand("superpowers:test-driven-development"));
  assert.match(ctx, /Skill\(mattpocock-skills:tdd\)/);
});

test("prompt-expansion: /using-git-worktrees → Skill(osuperpowers:finishing) (shared target)", () => {
  const ctx = context(runCommand("/using-git-worktrees"));
  assert.match(ctx, /Skill\(osuperpowers:finishing\)/);
});

test("prompt-expansion: /finishing-a-development-branch → Skill(osuperpowers:finishing)", () => {
  const ctx = context(runCommand("/finishing-a-development-branch"));
  assert.match(ctx, /Skill\(osuperpowers:finishing\)/);
});

test("prompt-expansion: /spor-* no longer matches (exit 0, empty output)", () => {
  const out = run("/spor-brainstorming");
  assert.equal(out.trim(), "");
});

test("prompt-expansion: unknown command exits 0 with empty output", () => {
  const out = runCommand("other:thing");
  assert.equal(out.trim(), "");
});
