#!/usr/bin/env node
// scripts/emit.mjs — do not edit
import { readFileSync } from "node:fs";

const input = readFileSync(0, "utf8");
let commandName = "";
try {
  const parsed = JSON.parse(input);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    commandName = parsed.command_name ?? "";
  }
} catch {
  // not JSON — treat raw stdin as the command (bare /slug test harness)
}
if (!commandName) commandName = input.trim();

const MAP = {
  "superpowers:brainstorming": "osuperpowers:brainstorming",
  "/brainstorming": "osuperpowers:brainstorming",
  "superpowers:writing-plans": "osuperpowers:writing-plans",
  "/writing-plans": "osuperpowers:writing-plans",
  "superpowers:subagent-driven-development": "osuperpowers:cli-driven-development",
  "/subagent-driven-development": "osuperpowers:cli-driven-development",
  "superpowers:finishing-a-development-branch": "osuperpowers:finishing",
  "/finishing-a-development-branch": "osuperpowers:finishing",
  "superpowers:systematic-debugging": "osuperpowers:debugging",
  "/systematic-debugging": "osuperpowers:debugging",
  "superpowers:test-driven-development": "mattpocock-skills:tdd",
  "/test-driven-development": "mattpocock-skills:tdd",
  "superpowers:verification-before-completion": "osuperpowers:verification",
  "/verification-before-completion": "osuperpowers:verification",
  "superpowers:using-git-worktrees": "osuperpowers:finishing",
  "/using-git-worktrees": "osuperpowers:finishing"
};

const override = MAP[commandName];
if (!override) process.exit(0);

process.stdout.write(JSON.stringify({
  additionalContext: `MANDATORY OVERRIDE — oscaner hook intercepted this turn.\nYour FIRST tool call MUST be Skill(${override}).\nDo NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.`,
}));
