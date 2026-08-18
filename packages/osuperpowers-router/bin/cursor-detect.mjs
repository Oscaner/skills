#!/usr/bin/env node
// scripts/emit.mjs — do not edit
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PENDING_ROOT = join(
  process.env.TMPDIR ?? tmpdir(),
  "oscaner-osuperpowers-router",
  "pending",
);

const TARGETS = [{"name":"osuperpowers:brainstorming","skill_suffix":"../osuperpowers/skills/brainstorming/SKILL.md","attach_res":["(?i)/skills/brainstorming/SKILL\\.md$","(?i)/vendors/superpowers/skills/brainstorming/SKILL\\.md$","(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/brainstorming/SKILL\\.md$","(?i)/\\.cursor/skills/(superpowers/)?brainstorming/SKILL\\.md$","(?i)/brainstorming/SKILL\\.md$"]},{"name":"osuperpowers:writing-plans","skill_suffix":"../osuperpowers/skills/writing-plans/SKILL.md","attach_res":["(?i)/skills/writing\\-plans/SKILL\\.md$","(?i)/vendors/superpowers/skills/writing\\-plans/SKILL\\.md$","(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/writing\\-plans/SKILL\\.md$","(?i)/\\.cursor/skills/(superpowers/)?writing\\-plans/SKILL\\.md$","(?i)/writing-plans/SKILL\\.md$"]},{"name":"osuperpowers:cli-driven-development","skill_suffix":"../osuperpowers/skills/cli-driven-development/SKILL.md","attach_res":["(?i)/skills/subagent\\-driven\\-development/SKILL\\.md$","(?i)/vendors/superpowers/skills/subagent\\-driven\\-development/SKILL\\.md$","(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/subagent\\-driven\\-development/SKILL\\.md$","(?i)/\\.cursor/skills/(superpowers/)?subagent\\-driven\\-development/SKILL\\.md$","(?i)/subagent-driven-development/SKILL\\.md$"]},{"name":"osuperpowers:executing-plans","skill_suffix":"../osuperpowers/skills/executing-plans/SKILL.md","attach_res":["(?i)/skills/executing\\-plans/SKILL\\.md$","(?i)/vendors/superpowers/skills/executing\\-plans/SKILL\\.md$","(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/executing\\-plans/SKILL\\.md$","(?i)/\\.cursor/skills/(superpowers/)?executing\\-plans/SKILL\\.md$","(?i)/executing-plans/SKILL\\.md$"]},{"name":"osuperpowers:finishing","skill_suffix":"../osuperpowers/skills/finishing/SKILL.md","attach_res":["(?i)/skills/finishing\\-a\\-development\\-branch/SKILL\\.md$","(?i)/vendors/superpowers/skills/finishing\\-a\\-development\\-branch/SKILL\\.md$","(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/finishing\\-a\\-development\\-branch/SKILL\\.md$","(?i)/\\.cursor/skills/(superpowers/)?finishing\\-a\\-development\\-branch/SKILL\\.md$","(?i)/finishing-a-development-branch/SKILL\\.md$"]},{"name":"osuperpowers:debugging","skill_suffix":"../osuperpowers/skills/debugging/SKILL.md","attach_res":["(?i)/skills/systematic\\-debugging/SKILL\\.md$","(?i)/vendors/superpowers/skills/systematic\\-debugging/SKILL\\.md$","(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/systematic\\-debugging/SKILL\\.md$","(?i)/\\.cursor/skills/(superpowers/)?systematic\\-debugging/SKILL\\.md$","(?i)/systematic-debugging/SKILL\\.md$"]},{"name":"mattpocock-skills:tdd","skill_suffix":"skills/osuperpowers/tdd/SKILL.md","attach_res":["(?i)/skills/test\\-driven\\-development/SKILL\\.md$","(?i)/vendors/superpowers/skills/test\\-driven\\-development/SKILL\\.md$","(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/test\\-driven\\-development/SKILL\\.md$","(?i)/\\.cursor/skills/(superpowers/)?test\\-driven\\-development/SKILL\\.md$","(?i)/test-driven-development/SKILL\\.md$"]},{"name":"osuperpowers:verification","skill_suffix":"../osuperpowers/skills/verification/SKILL.md","attach_res":["(?i)/skills/verification\\-before\\-completion/SKILL\\.md$","(?i)/vendors/superpowers/skills/verification\\-before\\-completion/SKILL\\.md$","(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/verification\\-before\\-completion/SKILL\\.md$","(?i)/\\.cursor/skills/(superpowers/)?verification\\-before\\-completion/SKILL\\.md$","(?i)/verification-before-completion/SKILL\\.md$"]},{"name":"osuperpowers:code-review","skill_suffix":"../osuperpowers/skills/code-review/SKILL.md","attach_res":["(?i)/skills/receiving\\-code\\-review/SKILL\\.md$","(?i)/vendors/superpowers/skills/receiving\\-code\\-review/SKILL\\.md$","(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/receiving\\-code\\-review/SKILL\\.md$","(?i)/\\.cursor/skills/(superpowers/)?receiving\\-code\\-review/SKILL\\.md$","(?i)/receiving-code-review/SKILL\\.md$"]},{"name":"osuperpowers:finishing","skill_suffix":"../osuperpowers/skills/finishing/SKILL.md","attach_res":["(?i)/skills/using\\-git\\-worktrees/SKILL\\.md$","(?i)/vendors/superpowers/skills/using\\-git\\-worktrees/SKILL\\.md$","(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/using\\-git\\-worktrees/SKILL\\.md$","(?i)/\\.cursor/skills/(superpowers/)?using\\-git\\-worktrees/SKILL\\.md$","(?i)/using-git-worktrees/SKILL\\.md$"]}];

function compilePattern(pat) {
  // Python `(?i)` inline flag → JS `i` RegExp flag (strip the prefix).
  const flags = pat.startsWith("(?i)") ? "i" : "";
  return new RegExp(pat.replace(/^\(\?i\)/, ""), flags);
}

function sessionKey(data) {
  if (data.conversation_id) return data.conversation_id;
  if (data.session_id) return data.session_id;
  return createHash("sha256")
    .update(data.prompt ?? "")
    .digest("hex")
    .slice(0, 16);
}

function failOpen() {
  process.stdout.write(JSON.stringify({ continue: true }));
}

let data;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  failOpen();
  process.exit(0);
}

const key = sessionKey(data);
const attachments = data.attachments ?? [];

outer: for (const t of TARGETS) {
  for (const att of attachments) {
    const path = att.file_path ?? att.path ?? "";
    if (!path) continue;
    for (const pat of t.attach_res) {
      if (compilePattern(pat).test(path)) {
        mkdirSync(PENDING_ROOT, { recursive: true });
        writeFileSync(
          join(PENDING_ROOT, `${key}.json`),
          JSON.stringify({
            override: t.name,
            skill_suffix: t.skill_suffix,
            trigger: "attach",
            detected_at: Math.floor(Date.now() / 1000),
          }),
        );
        break outer;
      }
    }
  }
}

process.stdout.write(JSON.stringify({ continue: true }));
