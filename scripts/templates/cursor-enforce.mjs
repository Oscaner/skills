#!/usr/bin/env node
// scripts/emit.mjs — do not edit
import { readFileSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PENDING_ROOT = join(
  process.env.TMPDIR ?? tmpdir(),
  "oscaner-superpowers-overrides",
  "pending",
);
const TTL = 300;

const READ_RES = {{READ_RES_JSON}};

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

function allow() {
  process.stdout.write(JSON.stringify({ permission: "allow" }));
}

let data;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  allow();
  process.exit(0);
}

const key = sessionKey(data);
const path = join(PENDING_ROOT, `${key}.json`);

if (!existsSync(path)) {
  allow();
  process.exit(0);
}

let pending;
try {
  pending = JSON.parse(readFileSync(path, "utf8"));
} catch {
  allow();
  process.exit(0);
}

const detectedAt = pending.detected_at ?? 0;
if (Math.floor(Date.now() / 1000) - detectedAt > TTL) {
  rmSync(path, { force: true });
  allow();
  process.exit(0);
}

const override = pending.override ?? "";
const toolName = data.tool_name ?? "";
const toolInput = data.tool_input ?? {};

let allowed = false;

if (toolName === "Read") {
  const readPath = toolInput.path ?? toolInput.file_path ?? "";
  if (readPath) {
    for (const pat of READ_RES[override] ?? []) {
      if (compilePattern(pat).test(readPath)) {
        allowed = true;
        break;
      }
    }
  }
}

if (toolName === "Skill") {
  if ((toolInput.skill ?? "") === override) {
    allowed = true;
  }
}

if (allowed) {
  rmSync(path, { force: true });
  allow();
  process.exit(0);
}

const skillSuffix = pending.skill_suffix ?? "";
const agentMessage =
  "MANDATORY OVERRIDE — upstream skill attached without the target override loaded.\n" +
  `Your FIRST tool call MUST be Read("${skillSuffix}") using the fullPath from agent_skills for ${override}.\n` +
  `(Claude Code: Skill("${override}") if available.)\n` +
  "Do NOT follow the upstream skill checklist until the target skill is loaded.";
process.stdout.write(
  JSON.stringify({ permission: "deny", agent_message: agentMessage }),
);
